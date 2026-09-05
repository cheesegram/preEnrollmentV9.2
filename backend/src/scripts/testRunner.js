import { MongoClient } from 'mongodb';
import readline from 'readline';
import { generateWorkload, attachCandidates, solveSchedule } from "../services/scheduleService.js"; 
import { VALID_START_TIMES, minutesToTime, isTimeOverlap } from '../utils/timeConstants.js';
import Schedule from '../models/Schedule.js';
import Section from '../models/Section.js';
import { rooms } from "../data/mockDb.js";

import 'dotenv/config';
import mongoose from 'mongoose';
import dns from 'node:dns/promises';

global.VALID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
global.VALID_START_TIMES = VALID_START_TIMES;
global.isTimeOverlap = isTimeOverlap;

let DB_NAME = "iiti_db";

// Override DNS servers to resolve MongoDB Atlas SRV records (fixes ECONNREFUSED)
dns.setServers(['1.1.1.1', '1.0.0.1']);

// --- Helper function to prompt user for input ---
const askQuestion = (query, rlInterface) => {
  return new Promise((resolve) => rlInterface.question(query, resolve));
};

// --- saving the schedule ---
async function saveSchedulePrompt(masterSchedule, metadata) {
  if (!masterSchedule || masterSchedule.length === 0) {
    console.log("\nSchedule is empty. Nothing to save.");
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    console.log("\n==============================================================================================");
    const answer = await askQuestion("Do you want to save this schedule to the database? (Yes/No): ", rl);
    const normalizedAnswer = answer.trim().toLowerCase();

    if (['y', 'yes'].includes(normalizedAnswer)) {
      console.log("Saving to database...");
      
      const newSchedule = new Schedule({
        curriculum_id: metadata.curriculum_id,
        academic_year: metadata.academic_year,
        semester: metadata.semester,
        classes: masterSchedule
      });

      await newSchedule.save();
      console.log("Schedule has been saved successfully to the 'schedules' collection!");
    } else {
      console.log("Draft discarded. Exiting without saving.");
    }
  } catch (error) {
    console.error("Error during save prompt:", error);
  } finally {
    rl.close();
  }
}

async function run() {
  try {
    console.log("Connecting to MongoDB via Mongoose...");
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;
    console.log("Connection successful.");

    // --- Test what collections are accessible ---
    console.log("\nFetching accessible collections in the database...");
    const collections = await db.listCollections().toArray();
    if (collections.length > 0) {
        console.log("Accessible collections found:");
        collections.forEach(c => console.log(`  - ${c.name}`));
    } else {
        console.log("Warning: No collections found or insufficient permissions to list them.");
    }
    console.log("----------------------------------------\n");


    // 1. Fetch all yearly curriculum templates
    const curriculumIds = [
      "curriculum_1st_year",
      "curriculum_2nd_year",
      "curriculum_3rd_year",
      "curriculum_4th_year"
    ];
    console.log(`Fetching curricula for IDs: ${curriculumIds.join(', ')}`);
    const curriculumDocs = await db.collection('curriculums').find({ _id: { $in: curriculumIds } }).toArray();

    if (curriculumDocs.length === 0) {
      throw new Error("No curriculum documents found for any year level. Please check the 'curriculums' collection.");
    }
    
    // 2. Extract all subjects directly from the fetched curriculum documents.
    // replaces the need for a separate 'subjects' collection query.
    const rawSubjectsFromDb = curriculumDocs.flatMap(doc => doc.subjects || []);
    if (rawSubjectsFromDb.length === 0) {
      throw new Error("No subjects found within the curriculum documents. Ensure the documents have a 'subjects' array.");
    }
    
    // We need to determine the year/semester for each subject. We can build a map from the `semesters` array.
    const subjectPlacementMap = new Map(curriculumDocs.flatMap(doc => doc.semesters?.flatMap(sem => sem.subjects?.map(sub => [sub.subject_code, { year: doc.year, semester: sem.semester }])) || []));

    // 3. Fetch professors from the database 
    const rawProfessorsFromDb = await db.collection('professors').find({}).toArray();

    // 4. Adapt the MongoDB professors into the format the generator expects
    const formattedProfessors = rawProfessorsFromDb.map(prof => {
      // Ensure specializations is always an array for the solver
      const specializations = Array.isArray(prof.specializations)
        ? prof.specializations
        : (typeof prof.specializations === 'string' && prof.specializations)
          ? [prof.specializations]
          : [];
      return { ...prof, id: prof._id.toString(), specializations };
    });

    // 5. Adapt the MongoDB subjects into the format that the generator functions expect
    const formattedSubjects = rawSubjectsFromDb.map(sub => {
      // Find where this subject belongs in the curriculum timeline using our new map
      const placement = subjectPlacementMap.get(sub.subject_code);
      
      // safeguard against undefined, null, or string remnants
      const lectureHours = Number(sub.lecture) || 0;
      const labHours = Number(sub.laboratory) || 0;
      
      // DETERMINE TYPE
      const isLab = labHours > 0;
      const sessionType = isLab ? "Laboratory" : "Lecture"; 

      // SAFE CALCULATION - Use a ternary operator that guarantees a concrete number output
      const duration = isLab ? (labHours * 60) : (lectureHours * 60);

      // DETECTIVE LOG: This will print out exactly what each subject is doing
      // console.log(`Debugging [${sub.subject_code}]: DB Lecture=${sub.lecture}, DB Lab=${sub.laboratory} -> Calculated Duration = ${duration} mins`);

      return {
        code: sub.subject_code,
        name: sub.title,
        year: placement ? parseInt(placement.year) : 1, // Ensure year is a number
        sem: placement ? placement.semester : 1,
        is_laboratory: isLab,
        type: sessionType, 
        durationMinutes: duration // This is now guaranteed to be a solid number
      };
    });

    console.log("Running scheduling pipeline stages...");

    // 6. Fetch sections from the database
    const dbSections = await Section.find({}).lean();
    const sections = dbSections.map(sec => ({
      name: sec.section, // Assuming 'section' field in DB maps to 'name' in workload
      year: parseInt(sec.year),
      sem: parseInt(sec.semester.replace('st', '').replace('nd', '')), // Convert '1st' to 1, '2nd' to 2
    }));

    const initialWorkload = generateWorkload(sections, formattedSubjects); // Use fetched sections
    const workloadWithCandidates = attachCandidates(initialWorkload, formattedProfessors, rooms);
    const { masterSchedule, unassignedSessions } = solveSchedule(workloadWithCandidates);

    // 7. Output results directly to terminal
    printMasterSchedule(masterSchedule);
    printUnassignedSessions(unassignedSessions);

    // 8. Prompt user to save the generated schedule
    await saveSchedulePrompt(masterSchedule, {
      curriculum_id: "master_schedule_AY2425_S1", // Use a composite ID for the master schedule
      academic_year: "2024-2025",
      semester: 2
    });

  } catch (error) {
    console.error("Execution error:", error);
  } finally {
    // Disconnect both clients
    await mongoose.disconnect();
    console.log("\nDatabase connection closed.");
  }
}



// --- Terminal Formatting Functions ---
function printMasterSchedule(schedule) {
  console.log("\n==============================================================================================");
  console.log("GENERATED MASTER SCHEDULE TIMETABLE");
  console.log("==============================================================================================");

  if (schedule.length === 0) {
    console.log("The master schedule is completely empty.");
    return;
  }

  // Use minutesToTime() helper to make the matrix readable
  const readableTableData = schedule.map(item => ({
    "Section": item.sectionName,
    "Subject": item.subjectCode,
    "Day": item.day,
    "Time Window": `${minutesToTime(item.startTime)} - ${minutesToTime(item.endTime)}`,
    "Room Allocation": item.roomName,
    "Professor Assigned": item.profName
  }));

  // Sort by Section, then Day to organize the terminal display
  readableTableData.sort((a, b) => a.Section.localeCompare(b.Section) || a.Day.localeCompare(b.Day));

  console.table(readableTableData);
}



function printUnassignedSessions(unassigned) {
  console.log("\n==============================================================================================");
  console.log("SESSIONS THAT FAILED CONSTRAINTS");
  console.log("==============================================================================================");

  if (unassigned.length === 0) {
    console.log("PERFECT! All requirements satisfied with absolute zero conflicts.");
  } else {
    console.log(`Could not allocate a valid time-slot & room combo for ${unassigned.length} items:`);
    const failureList = unassigned.map((msg, index) => ({ "No.": index + 1, "Failed Target Details": msg }));
    console.table(failureList);
  }
}

run();