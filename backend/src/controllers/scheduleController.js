import { generateWorkload, attachCandidates, solveSchedule } from '../services/scheduleService.js';
// import { rooms } from '../data/mockDb.js';
import Subject from '../models/Subject.js';
import Professor from '../models/Professor.js'; 
import Section from '../models/Section.js'; 
import mongoose from 'mongoose'; 

function getCurriculumModel() {
    const db = mongoose.connection;
    return db.models.Curriculum || db.model("Curriculum", new mongoose.Schema({}, { strict: false }), "curriculums");
}

export const generateSchedule = async (req, res) => {
    try {
        const Curriculum = getCurriculumModel();
        const curriculumIds = [
            "curriculum_1st_year",
            "curriculum_2nd_year",
            "curriculum_3rd_year",
            "curriculum_4th_year"
        ];
        const curriculumDocs = await Curriculum.find({ _id: { $in: curriculumIds } }).lean();

        if (curriculumDocs.length === 0) {
            return res.status(404).json({ success: false, message: "No curriculum documents found for any year level. Please check the 'curriculums' collection." });
        }

        // Extract and format subjects from curriculum documents
        const rawSubjectsFromDb = curriculumDocs.flatMap(doc => doc.subjects || []);
        if (rawSubjectsFromDb.length === 0) {
            return res.status(404).json({ success: false, message: "No subjects found within the curriculum documents. Ensure the documents have a 'subjects' array." });
        }

        const subjectPlacementMap = new Map(curriculumDocs.flatMap(doc => doc.semesters?.flatMap(sem => sem.subjects?.map(sub => [sub.subject_code, { year: doc.year, semester: sem.semester }])) || []));

        const subjects = rawSubjectsFromDb.map(sub => {
            const placement = subjectPlacementMap.get(sub.subject_code);
            const lectureHours = Number(sub.lecture) || 0;
            const labHours = Number(sub.laboratory) || 0;
            const isLab = labHours > 0;
            const sessionType = isLab ? "Laboratory" : "Lecture";
            const duration = isLab ? (labHours * 60) : (lectureHours * 60);

            return {
                code: sub.subject_code,
                name: sub.title,
                year: placement ? parseInt(placement.year) : 1,
                sem: placement ? placement.semester : 1,
                is_laboratory: isLab,
                type: sessionType,
                durationMinutes: duration
            };
        });

        // 2. Fetch professors from the database
        const dbProfessors = await Professor.find({}).lean();
        const professors = dbProfessors.map(prof => ({
            ...prof,
            id: prof._id.toString(),
            specializations: Array.isArray(prof.specializations) ? prof.specializations : [],
        }));

        // 3. Fetch sections from the database
        const dbSections = await Section.find({}).lean();
        const sections = dbSections.map(sec => ({
            name: sec.section,
            year: parseInt(sec.year),
            sem: parseInt(sec.semester.replace('st', '').replace('nd', '')), // '1st' to 1
        }));

        const rawWorkload = generateWorkload(sections, subjects);
        const workloadWithCandidates = attachCandidates(rawWorkload, professors, rooms);
        const result = solveSchedule(workloadWithCandidates);

        return res.status(200).json({
            success: true,
            totalScheduled: result.masterSchedule.length,
            failedToSchedule: result.unassignedSessions,
            data: result.masterSchedule
        });
    } catch (error) {
        console.error('Error generating schedule:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const finalizeSchedule = async (req, res) => {
    try {
        // 1. Fetch all yearly curriculum templates to get subjects
        const Curriculum = getCurriculumModel();
        const curriculumIds = [
            "curriculum_1st_year",
            "curriculum_2nd_year",
            "curriculum_3rd_year",
            "curriculum_4th_year"
        ];
        const curriculumDocs = await Curriculum.find({ _id: { $in: curriculumIds } }).lean();

        if (curriculumDocs.length === 0) {
            return res.status(404).json({ success: false, message: "No curriculum documents found for any year level. Please check the 'curriculums' collection." });
        }

        const rawSubjectsFromDb = curriculumDocs.flatMap(doc => doc.subjects || []);
        if (rawSubjectsFromDb.length === 0) {
            return res.status(404).json({ success: false, message: "No subjects found within the curriculum documents. Ensure the documents have a 'subjects' array." });
        }

        const subjectPlacementMap = new Map(curriculumDocs.flatMap(doc => doc.semesters?.flatMap(sem => sem.subjects?.map(sub => [sub.subject_code, { year: doc.year, semester: sem.semester }])) || []));

        const subjects = rawSubjectsFromDb.map(sub => {
            const placement = subjectPlacementMap.get(sub.subject_code);
            const lectureHours = Number(sub.lecture) || 0;
            const labHours = Number(sub.laboratory) || 0;
            const isLab = labHours > 0;
            const sessionType = isLab ? "Laboratory" : "Lecture";
            const duration = isLab ? (labHours * 60) : (lectureHours * 60);

            return {
                code: sub.subject_code,
                name: sub.title,
                year: placement ? parseInt(placement.year) : 1,
                sem: placement ? placement.semester : 1,
                is_laboratory: isLab,
                type: sessionType,
                durationMinutes: duration
            };
        });

        const dbProfessors = await Professor.find({}).lean();
        const professors = dbProfessors.map(prof => ({ ...prof, id: prof._id.toString(), specializations: Array.isArray(prof.specializations) ? prof.specializations : [] }));
        const dbSections = await Section.find({}).lean();
        const sections = dbSections.map(sec => ({ name: sec.section, year: parseInt(sec.year), sem: parseInt(sec.semester.replace('st', '').replace('nd', '')) }));

        const { masterSchedule, unassignedSessions } = solveSchedule(workloadWithCandidates);

        return res.status(201).json({
            success: true,
            metadata: {
                timestamp: new Date().toISOString(),
                totalClasses: masterSchedule.length,
                warnings: unassignedSessions
            },
            schedule: masterSchedule
        });
    } catch (error) {
        console.error('Error finalizing schedule:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};