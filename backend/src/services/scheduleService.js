import { VALID_DAYS, VALID_START_TIMES } from '../utils/timeConstants.js';

// --- STEP 1: REQUIREMENT AGGREGATOR ---
// creates a list of all classes that need to be scheduled.
// it takes each section and finds all the subjects they need to take.
// for each subject, it creates a "workload item" that needs to be assigned to a professor, room, and time.
export function generateWorkload(sectionsList, subjectsList) {
  let unassignedWorkload = [];

  // Loop through every section
  sectionsList.forEach(section => {
    
    // Filter subjects that match the section's year and semester requirements
    const requiredSubjects = subjectsList.filter(
      subject => subject.year === section.year && subject.sem === section.sem
    );

    // Create a specific "session" for each required subject for this specific section
    requiredSubjects.forEach(subject => {
      unassignedWorkload.push({
        sectionName: section.name,
        subjectCode: subject.code,
        subjectName: subject.name,
        isLaboratory: subject.is_laboratory,
        type: subject.type,
        durationMinutes: subject.durationMinutes,
        // leave these as null; Step 2 and 3 will fill these
        assignedProfessor: null,
        assignedRoom: null,
        assignedTimeslot: null 
      });
    });
  });

  return unassignedWorkload;
}


// --- LOGIC STEP 2: RESOURCE FILTERING ---
// finds which professors and rooms are available for each class.
// For each class in the workload, it finds all professors who can teach that subject
// and all rooms that match the class type (lecture room or lab room).
// These "candidates" are stored with each class so the scheduler knows what options are available.
export function attachCandidates(workload, professorsList, roomsList) {
  // use .map() to transform each session in the workload array
  return workload.map(session => {
    
    // 1. Filter profs with specialization in this subject code
    const candidateProfs = professorsList.filter(prof => 
      prof.specializations.includes(session.subjectCode)
    );

    // 2. Filter rooms that match the session type (Lecture or Laboratory)
    const candidateRooms = roomsList.filter(room => 
      room.type === session.type
    );

    // 3. Return a new object that includes the original session data PLUS the new candidates
    return {
      ...session, // The spread operator (...) copies all properties from Step 1
      candidateProfs, // This is an array of valid professor objects
      candidateRooms // This is an array of valid room objects
    };
  });
}



// This helper function checks if a proposed class time causes conflictsin the schedule.
// It returns TRUE if:
//   - The same professor is already teaching another class at that time, OR
//   - The same room is already in use at that time, OR  
//   - The same section (student group) already has another class at that time
// Returns FALSE if the proposed time slot is SAFE to use.
function isConflict(trialAssignment, masterSchedule) {
  return masterSchedule.some(existing => {
    
    // Only check for time overlaps if they are on the SAME DAY
    if (existing.day === trialAssignment.day) {
      
      const overlap = isTimeOverlap(
        trialAssignment.startTime, trialAssignment.endTime,
        existing.startTime, existing.endTime
      );
      
      if (overlap) {
        // if room is already taken
        if (existing.roomId === trialAssignment.roomId) return true;
        
        // if prof is already teaching at that time
        if (existing.profId === trialAssignment.profId) return true;
        
        // if this section already has a class
        if (existing.sectionName === trialAssignment.sectionName) return true;
      }
    }
    return false;
  });
}



// --- LOGIC STEP 3: THE GREEDY SCHEDULER (main scheduling algorithm) --- 
// assigns a time, room, and professor to each class.
// It uses a "greedy" approach: go through each class and assign it to the FIRST available time slot that works.
// Laboratory classes are prioritized & scheduled first
// Returns a schedule with all successfully assigned classes, & a list of classes that couldn't be scheduled.
export function solveSchedule(workloadWithCandidates) {
  let masterSchedule = [];
  let unassignedSessions = [];

  // Sort by priority so Laboratories get processed first!
  const sortedWorkload = [...workloadWithCandidates].sort((a, b) => b.isLaboratory - a.isLaboratory);

  // loop thru each session that we need to schedule
  for (const session of sortedWorkload) {
    let assigned = false;

    // Loop through the optimized time grid
    // try every possible combination until one fits
    // nested, so we can find the 1st 'open window'
    for (const day of VALID_DAYS) {
      for (const startTime of VALID_START_TIMES) {
        
        const endTime = startTime + session.durationMinutes;

        // Ensure this class doesn't clip past the end of the school day (8:00 PM / 1200 mins)
        if (endTime > 1200) continue;

        for (const room of session.candidateRooms) {
          for (const prof of session.candidateProfs) {
            
            const trial = {
              sectionName: session.sectionName,
              subjectCode: session.subjectCode,
              day,
              startTime,
              endTime,
              roomId: room.id,
              roomName: room.name,
              profId: prof.id,
              profName: prof.name
            };

            if (!isConflict(trial, masterSchedule)) {   // if there's no conflict in trial & master schedule,
              masterSchedule.push(trial);               // push the trial-sched into the master-sched
              assigned = true;
              break;
            }
          }
          if (assigned) break; // break the prof loop
        }
        if (assigned) break; // break the room loop
      }
      if (assigned) break; // break the timeslot loop
    }

    if (!assigned) {
      unassignedSessions.push(`${session.subjectCode} for ${session.sectionName}`);
    }
  }

  return { masterSchedule, unassignedSessions };
}


