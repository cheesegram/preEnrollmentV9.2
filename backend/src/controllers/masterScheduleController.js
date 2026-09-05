import mongoose from 'mongoose';
import Schedule from '../models/Schedule.js';
import { isTimeOverlap } from '../utils/timeConstants.js';

const curriculumSchema = new mongoose.Schema(
    { _id: String },
    { strict: false, versionKey: false }
);

function getCurriculumModel() {
    const db = mongoose.connection;
    return db.models.Curriculum || db.model('Curriculum', curriculumSchema, 'curriculums');
}

function normalizeYear(value) {
    const raw = String(value ?? '').trim().toLowerCase();
    const match = raw.match(/[1-4]/);
    return match ? match[0] : raw;
}

function normalizeSubjectCode(value) {
    return String(value ?? '').trim().toUpperCase();
}

function createSubjectKey(year, semester, subjectCode) {
    return `${normalizeYear(year)}::${normalizeSemester(semester)}::${normalizeSubjectCode(subjectCode)}`;
}

function getCurriculumSubjects(document) {
    if (Array.isArray(document?.semesters)) {
        return document.semesters.flatMap((semester) =>
            (Array.isArray(semester?.subjects) ? semester.subjects : []).map((subject) => ({
                subject,
                semester: semester.semester,
            }))
        );
    }

    return (Array.isArray(document?.subjects) ? document.subjects : []).map((subject) => ({
        subject,
        semester: document.semester,
    }));
}

function buildCurriculumSubjectLookup(curriculumDocuments) {
    const lookup = new Map();
    const subjectsByCode = new Map();

    for (const document of curriculumDocuments) {
        const documentYear = document?.year ?? String(document?._id ?? '').match(/curriculum_([1-4])/i)?.[1];
        for (const entry of getCurriculumSubjects(document)) {
            const subjectCode = normalizeSubjectCode(entry.subject?.subject_code ?? entry.subject?.code);
            if (!subjectCode) continue;

            const subjectDetails = {
                title: String(entry.subject?.title ?? '').trim(),
                units: Number(entry.subject?.units ?? 0),
            };
            lookup.set(createSubjectKey(documentYear, entry.semester, subjectCode), subjectDetails);
            if (!subjectsByCode.has(subjectCode)) subjectsByCode.set(subjectCode, subjectDetails);
        }
    }

    return { lookup, subjectsByCode };
}

function getScheduleYear(schedule, classEntry) {
    const explicitYear = String(schedule?.year ?? '').trim();
    if (explicitYear) return explicitYear;

    const sectionMatch = String(classEntry?.sectionName ?? '').match(/(?:^|-)([1-4])[A-Za-z]+$/i);
    if (sectionMatch) return sectionMatch[1];

    return String(schedule?.curriculum_id ?? '').match(/curriculum_([1-4])/i)?.[1] ?? '';
}

function enrichSchedules(schedules, curriculumSubjects) {
    return schedules.map((schedule) => ({
        ...schedule,
        classes: (Array.isArray(schedule.classes) ? schedule.classes : []).map((classEntry) => {
            const subjectCode = normalizeSubjectCode(classEntry.subjectCode);
            const curriculumSubject = curriculumSubjects.lookup.get(
                createSubjectKey(getScheduleYear(schedule, classEntry), schedule.semester, subjectCode)
            ) ?? curriculumSubjects.subjectsByCode.get(subjectCode);

            return {
                ...classEntry,
                subjectName: curriculumSubject?.title ?? classEntry.subjectName ?? '',
                subjectTitle: curriculumSubject?.title ?? classEntry.subjectTitle ?? '',
                units: curriculumSubject?.units ?? Number(classEntry.units ?? 0),
            };
        }),
    }));
}

async function getCurriculumSubjectLookup() {
    const Curriculum = getCurriculumModel();
    const curriculumDocuments = await Curriculum.find({}).lean();
    return buildCurriculumSubjectLookup(curriculumDocuments);
}

function normalizeSemester(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    return raw.toLowerCase().includes('semester') ? raw : `${raw} Semester`;
}

function normalizeAcademicYear(value) {
    return String(value ?? '').trim().replace(/\s*-\s*/g, ' - ');
}

function normalizeDays(classEntry) {
    if (Array.isArray(classEntry?.days)) {
        return [...new Set(classEntry.days.map((day) => String(day ?? '').trim()).filter(Boolean))];
    }

    const singleDay = String(classEntry?.day ?? '').trim();
    return singleDay ? [singleDay] : [];
}

function toNumberOrNull(value) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
}

function toDisplayTime(totalMinutes) {
    const minutes = toNumberOrNull(totalMinutes);
    if (minutes == null) return 'Unknown Time';

    const hour24 = Math.floor(minutes / 60) % 24;
    const minutePart = minutes % 60;
    const suffix = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 % 12 || 12;
    return `${hour12}:${String(minutePart).padStart(2, '0')} ${suffix}`;
}

function getSectionLabel(schedule, classEntry) {
    const rawSection = String(schedule?.section ?? classEntry?.sectionName ?? '').trim();
    const rawYear = String(schedule?.year ?? '').trim();

    if (!rawSection) return '';
    if (!rawYear) return rawSection;
    return rawSection.startsWith(rawYear) ? rawSection : `${rawYear}${rawSection}`;
}

function buildScheduleConflicts(schedules) {
    const conflicts = [];

    for (const schedule of schedules) {
        const classes = Array.isArray(schedule?.classes) ? schedule.classes : [];
        for (let i = 0; i < classes.length; i += 1) {
            for (let j = i + 1; j < classes.length; j += 1) {
                const left = classes[i];
                const right = classes[j];

                const leftStart = toNumberOrNull(left?.startTime);
                const leftEnd = toNumberOrNull(left?.endTime);
                const rightStart = toNumberOrNull(right?.startTime);
                const rightEnd = toNumberOrNull(right?.endTime);

                if (leftStart == null || leftEnd == null || rightStart == null || rightEnd == null) continue;

                const leftDays = normalizeDays(left);
                const rightDays = normalizeDays(right);
                const overlappingDays = leftDays.filter((day) => rightDays.includes(day));
                if (overlappingDays.length === 0) continue;

                if (!isTimeOverlap(leftStart, leftEnd, rightStart, rightEnd)) continue;

                const leftRoom = String(left?.roomName ?? left?.roomId ?? '').trim();
                const rightRoom = String(right?.roomName ?? right?.roomId ?? '').trim();
                const leftProf = String(left?.profName ?? left?.profId ?? '').trim();
                const rightProf = String(right?.profName ?? right?.profId ?? '').trim();
                const leftSection = String(left?.sectionName ?? '').trim();
                const rightSection = String(right?.sectionName ?? '').trim();

                const slot = `${overlappingDays.join('/')} ${toDisplayTime(Math.max(leftStart, rightStart))} - ${toDisplayTime(Math.min(leftEnd, rightEnd))}`;
                const semester = normalizeSemester(schedule?.semester);
                const schoolYear = normalizeAcademicYear(schedule?.academic_year ?? schedule?.academicYear);
                const section = getSectionLabel(schedule, left);

                if (leftRoom && rightRoom && leftRoom === rightRoom) {
                    conflicts.push({
                        scheduleId: String(schedule?._id ?? ''),
                        section,
                        semester,
                        schoolYear,
                        message: `Room conflict: ${leftRoom} is double-booked on ${slot}.`,
                    });
                }

                if (leftProf && rightProf && leftProf === rightProf) {
                    conflicts.push({
                        scheduleId: String(schedule?._id ?? ''),
                        section,
                        semester,
                        schoolYear,
                        message: `Instructor conflict: ${leftProf} is assigned to overlapping classes on ${slot}.`,
                    });
                }

                if (leftSection && rightSection && leftSection === rightSection) {
                    conflicts.push({
                        scheduleId: String(schedule?._id ?? ''),
                        section,
                        semester,
                        schoolYear,
                        message: `Section conflict: ${leftSection} has overlapping classes on ${slot}.`,
                    });
                }
            }
        }
    }

    return conflicts;
}

export async function getScheduleConflicts(req, res) {
    try {
        const schedules = await Schedule.find({}).lean();
        const conflicts = buildScheduleConflicts(schedules);
        const hasConflicts = conflicts.length > 0;

        res.status(200).json({
            hasConflicts,
            status: hasConflicts
                ? {
                    hasConflicts: true,
                    message: `${conflicts.length} Schedule Conflict${conflicts.length > 1 ? 's' : ''} Detected`,
                    description: 'Review overlapping section, instructor, or room assignments.',
                }
                : {
                    hasConflicts: false,
                    message: 'No Schedule Conflicts Detected',
                    description: 'All assigned schedules passed validation.',
                },
            conflicts,
        });
    } catch (error) {
        console.error('Error fetching schedule conflicts:', error);
        res.status(500).json({ message: 'Internal server error while fetching schedule conflicts.' });
    }
}

export async function updateScheduleClasses(req, res) {
    try {
        const { id } = req.params;
        const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];

        if (updates.length === 0) {
            return res.status(400).json({ message: 'No class updates were provided.' });
        }

        const schedule = await Schedule.findById(id).lean();
        if (!schedule) {
            return res.status(404).json({ message: 'Schedule not found with the provided ID.' });
        }

        const classes = Array.isArray(schedule.classes) ? [...schedule.classes] : [];
        let updatedCount = 0;

        for (const update of updates) {
            const classIndex = Number(update?.classIndex);
            if (!Number.isInteger(classIndex) || classIndex < 0 || classIndex >= classes.length) {
                continue;
            }

            const changes = update?.changes && typeof update.changes === 'object' ? { ...update.changes } : {};

            if (Object.prototype.hasOwnProperty.call(changes, 'days')) {
                const normalizedDays = Array.isArray(changes.days)
                    ? [...new Set(changes.days.map((day) => String(day ?? '').trim()).filter(Boolean))]
                    : [];
                changes.days = normalizedDays;
                changes.day = normalizedDays[0] ?? '';
            }

            if (Object.prototype.hasOwnProperty.call(changes, 'startTime')) {
                const numericStart = toNumberOrNull(changes.startTime);
                if (numericStart == null) {
                    delete changes.startTime;
                } else {
                    changes.startTime = numericStart;
                }
            }

            if (Object.prototype.hasOwnProperty.call(changes, 'endTime')) {
                const numericEnd = toNumberOrNull(changes.endTime);
                if (numericEnd == null) {
                    delete changes.endTime;
                } else {
                    changes.endTime = numericEnd;
                }
            }

            if (
                Object.prototype.hasOwnProperty.call(changes, 'startTime') &&
                Object.prototype.hasOwnProperty.call(changes, 'endTime') &&
                changes.startTime >= changes.endTime
            ) {
                return res.status(400).json({ message: `Invalid time range for classIndex ${classIndex}.` });
            }

            classes[classIndex] = {
                ...(classes[classIndex] ?? {}),
                ...changes,
            };

            updatedCount += 1;
        }

        if (updatedCount === 0) {
            return res.status(400).json({ message: 'No valid class updates were provided.' });
        }

        await Schedule.updateOne(
            { _id: id },
            { $set: { classes, updated_at: new Date() } }
        );

        res.status(200).json({
            success: true,
            scheduleId: String(schedule._id ?? id),
            updatedCount,
        });
    } catch (error) {
        console.error(`Error updating schedule classes (${req.params.id}):`, error);
        res.status(500).json({ message: 'Internal server error while updating schedule classes.' });
    }
}

export async function getAllSchedules(req, res) {
    try {
        const [schedules, curriculumSubjects] = await Promise.all([
            Schedule.find({}).sort({ generatedAt: -1, generated_at: -1 }).lean(),
            getCurriculumSubjectLookup(),
        ]);
        res.status(200).json(enrichSchedules(schedules, curriculumSubjects));
    } catch (error) {
        console.error("Error fetching all schedules:", error);
        res.status(500).json({ message: "Internal server error while fetching schedules." });
    }
}

export async function getScheduleById(req, res) {
    try {
        const { id } = req.params;
        const schedule = await Schedule.findById(id).lean();

        if (!schedule) {
            return res.status(404).json({ message: 'Schedule not found with the provided ID.' });
        }

        const curriculumSubjects = await getCurriculumSubjectLookup();
        res.status(200).json(enrichSchedules([schedule], curriculumSubjects)[0]);
    } catch (error) {
        console.error(`Error fetching schedule by ID (${req.params.id}):`, error);
        res.status(500).json({ message: 'Internal server error while fetching schedule details.' });
    }
}

const EDITABLE_CLASS_FIELDS = new Set([
    'subjectCode',
    'subjectTitle',
    'units',
    'day',
    'days',
    'startTime',
    'endTime',
    'roomName',
    'profName',
]);

function sanitizeClassChanges(incomingChanges) {
    if (!incomingChanges || typeof incomingChanges !== 'object' || Array.isArray(incomingChanges)) {
        return null;
    }

    const changes = {};
    for (const [field, value] of Object.entries(incomingChanges)) {
        if (!EDITABLE_CLASS_FIELDS.has(field)) continue;
        changes[field] = value;
    }

    return changes;
}

function buildClassPathUpdates(classIndex, incomingChanges) {
    const sanitizedChanges = sanitizeClassChanges(incomingChanges);
    if (!sanitizedChanges) return null;

    const updates = {};
    for (const [field, value] of Object.entries(sanitizedChanges)) {
        updates[`classes.${classIndex}.${field}`] = value;
    }
    return updates;
}

export async function patchScheduleClasses(req, res) {
    try {
        const { id } = req.params;
        const updatesPayload = req.body?.updates;

        if (!Array.isArray(updatesPayload) || updatesPayload.length === 0) {
            return res.status(400).json({ message: 'Request body must include a non-empty updates array.' });
        }

        const updates = {};
        const touchedClassIndices = new Set();

        for (const entry of updatesPayload) {
            const numericClassIndex = Number(entry?.classIndex);
            if (!Number.isInteger(numericClassIndex) || numericClassIndex < 0) {
                continue;
            }

            const classUpdates = buildClassPathUpdates(numericClassIndex, entry?.changes);
            if (!classUpdates || Object.keys(classUpdates).length === 0) {
                continue;
            }

            Object.assign(updates, classUpdates);
            touchedClassIndices.add(numericClassIndex);
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: 'No valid class updates were provided.' });
        }

        updates.updatedAt = new Date();

        const updatedSchedule = await Schedule.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true }
        ).lean();

        if (!updatedSchedule) {
            return res.status(404).json({ message: 'Schedule not found with the provided ID.' });
        }

        const changedClasses = Array.from(touchedClassIndices)
            .sort((left, right) => left - right)
            .map((classIndex) => ({
                classIndex,
                updatedClass: Array.isArray(updatedSchedule.classes) ? updatedSchedule.classes[classIndex] : undefined,
            }));

        return res.status(200).json({
            message: 'Schedule classes updated successfully.',
            scheduleId: updatedSchedule._id,
            updatedCount: changedClasses.length,
            changedClasses,
        });
    } catch (error) {
        console.error(`Error patching schedule classes (${req.params.id}):`, error);
        return res.status(500).json({ message: 'Internal server error while updating schedule classes.' });
    }
}

export { updateScheduleClasses as updateScheduleClassesHandler };
