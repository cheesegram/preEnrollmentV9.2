import { isTimeOverlap } from '../utils/timeConstants.js';

function formatMinutesToTime(minutes) {
    const numericMinutes = Number(minutes);
    if (!Number.isFinite(numericMinutes)) return '';

    const hours = Math.floor(numericMinutes / 60) % 24;
    const minuteValue = numericMinutes % 60;
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    return `${displayHour}:${String(minuteValue).padStart(2, '0')} ${suffix}`;
}

function parseTimeToMinutes(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    const raw = String(value ?? '').trim();
    if (!raw) return null;

    const meridiemMatch = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (meridiemMatch) {
        const hours = Number(meridiemMatch[1]);
        const minutes = Number(meridiemMatch[2]);
        if (Number.isNaN(hours) || Number.isNaN(minutes) || hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
            return null;
        }
        const meridiem = meridiemMatch[3].toUpperCase();
        const normalizedHours = hours % 12;
        const twentyFourHour = meridiem === 'PM' ? normalizedHours + 12 : normalizedHours;
        return twentyFourHour * 60 + minutes;
    }

    const twentyFourMatch = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (twentyFourMatch) {
        const hours = Number(twentyFourMatch[1]);
        const minutes = Number(twentyFourMatch[2]);
        if (Number.isNaN(hours) || Number.isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            return null;
        }
        return hours * 60 + minutes;
    }

    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : null;
}

function getDaysList(classEntry) {
    if (Array.isArray(classEntry.days) && classEntry.days.length > 0) {
        return classEntry.days.map((d) => String(d ?? '').trim()).filter(Boolean);
    }
    if (classEntry.day) {
        return [String(classEntry.day).trim()].filter(Boolean);
    }
    return [];
}

function getSectionName(schedule, classEntry) {
    const year = String(schedule?.year ?? '').trim();
    const section = String(schedule?.section ?? '').trim();
    if (year && section && !section.startsWith(year)) {
        return `${year}${section}`;
    }
    if (section) return section;

    const classSectionName = String(classEntry?.sectionName ?? '').trim();
    const match = classSectionName.match(/[0-9]+[A-Za-z]+$/);
    if (match) return match[0];

    return classSectionName || 'Unassigned';
}

function formatSemester(value) {
    const raw = String(value ?? '').trim().toLowerCase();
    if (raw.includes('1')) return '1st Semester';
    if (raw.includes('2')) return '2nd Semester';
    return raw || '1st Semester';
}

function formatAcademicYear(value) {
    const raw = String(value ?? '').trim();
    return raw.replace(/\s*-\s*/g, ' - ');
}

/**
 * Extracts all flattened class sessions from the schedules array.
 */
export function extractClassSessions(schedules) {
    const sessions = [];

    for (const schedule of schedules) {
        const scheduleId = String(schedule._id ?? '');
        const semester = formatSemester(schedule.semester);
        const schoolYear = formatAcademicYear(schedule.academicYear ?? schedule.academic_year ?? '');
        const classes = Array.isArray(schedule.classes) ? schedule.classes : [];

        classes.forEach((classEntry, index) => {
            const section = getSectionName(schedule, classEntry);
            const days = getDaysList(classEntry);
            const startMinutes = parseTimeToMinutes(classEntry.startTime);
            const endMinutes = parseTimeToMinutes(classEntry.endTime);
            const subjectCode = String(classEntry.subjectCode ?? '').trim();
            const subjectTitle = String(classEntry.subjectTitle ?? classEntry.subjectName ?? '').trim();
            const instructor = String(classEntry.profName ?? classEntry.profId ?? classEntry.instructor ?? '').trim();
            const room = String(classEntry.roomName ?? classEntry.roomId ?? classEntry.room ?? '').trim();

            if (startMinutes !== null && endMinutes !== null && startMinutes < endMinutes && days.length > 0) {
                sessions.push({
                    scheduleId,
                    classIndex: index,
                    section,
                    semester,
                    schoolYear,
                    subjectCode: subjectCode || 'Unknown Subject',
                    subjectTitle,
                    instructor,
                    room,
                    days,
                    startMinutes,
                    endMinutes,
                    timeDisplay: `${formatMinutesToTime(startMinutes)} - ${formatMinutesToTime(endMinutes)}`,
                });
            }
        });
    }

    return sessions;
}

/**
 * Detects all scheduling conflicts (section time overlaps, instructor clashes, room clashes).
 */
export function detectScheduleConflicts(schedules) {
    const sessions = extractClassSessions(Array.isArray(schedules) ? schedules : []);
    const conflicts = [];
    const seenConflictKeys = new Set();

    for (let i = 0; i < sessions.length; i++) {
        for (let j = i + 1; j < sessions.length; j++) {
            const a = sessions[i];
            const b = sessions[j];

            // Only check conflicts within the same academic year and semester
            if (a.semester !== b.semester || a.schoolYear !== b.schoolYear) {
                continue;
            }

            // Find overlapping days
            const commonDays = a.days.filter((day) => b.days.includes(day));
            if (commonDays.length === 0) {
                continue;
            }

            // Check time overlap
            const overlaps = isTimeOverlap(a.startMinutes, a.endMinutes, b.startMinutes, b.endMinutes);
            if (!overlaps) {
                continue;
            }

            for (const day of commonDays) {
                // 1. Same Section Conflict
                if (a.section && b.section && a.section.toLowerCase() === b.section.toLowerCase()) {
                    const conflictKey = `section::${a.section}::${day}::${Math.min(a.startMinutes, b.startMinutes)}::${Math.max(a.endMinutes, b.endMinutes)}::${[a.subjectCode, b.subjectCode].sort().join('-')}`;
                    if (!seenConflictKeys.has(conflictKey)) {
                        seenConflictKeys.add(conflictKey);
                        conflicts.push({
                            type: 'section',
                            severity: 'error',
                            day,
                            section: a.section,
                            semester: a.semester,
                            schoolYear: a.schoolYear,
                            subjectCodes: [a.subjectCode, b.subjectCode],
                            classA: { subjectCode: a.subjectCode, time: a.timeDisplay, section: a.section },
                            classB: { subjectCode: b.subjectCode, time: b.timeDisplay, section: b.section },
                            message: `Time overlap in Section ${a.section}: ${a.subjectCode} (${a.timeDisplay}) and ${b.subjectCode} (${b.timeDisplay}) are both scheduled on ${day}.`,
                        });
                    }
                }

                // 2. Same Instructor Conflict
                const isInstructorValid = a.instructor && b.instructor && !['tba', 'unassigned', 'none', 'n/a'].includes(a.instructor.toLowerCase());
                if (isInstructorValid && a.instructor.toLowerCase() === b.instructor.toLowerCase()) {
                    const conflictKey = `instructor::${a.instructor}::${day}::${Math.min(a.startMinutes, b.startMinutes)}::${Math.max(a.endMinutes, b.endMinutes)}`;
                    if (!seenConflictKeys.has(conflictKey)) {
                        seenConflictKeys.add(conflictKey);
                        conflicts.push({
                            type: 'instructor',
                            severity: 'error',
                            day,
                            instructor: a.instructor,
                            semester: a.semester,
                            schoolYear: a.schoolYear,
                            subjectCodes: [a.subjectCode, b.subjectCode],
                            classA: { subjectCode: a.subjectCode, time: a.timeDisplay, section: a.section },
                            classB: { subjectCode: b.subjectCode, time: b.timeDisplay, section: b.section },
                            message: `Instructor conflict for ${a.instructor}: scheduled for ${a.subjectCode} (Section ${a.section}) and ${b.subjectCode} (Section ${b.section}) at overlapping times on ${day}.`,
                        });
                    }
                }

                // 3. Same Room Conflict
                const isRoomValid = a.room && b.room && !['tba', 'unassigned', 'none', 'online', 'n/a'].includes(a.room.toLowerCase());
                if (isRoomValid && a.room.toLowerCase() === b.room.toLowerCase()) {
                    const conflictKey = `room::${a.room}::${day}::${Math.min(a.startMinutes, b.startMinutes)}::${Math.max(a.endMinutes, b.endMinutes)}`;
                    if (!seenConflictKeys.has(conflictKey)) {
                        seenConflictKeys.add(conflictKey);
                        conflicts.push({
                            type: 'room',
                            severity: 'error',
                            day,
                            room: a.room,
                            semester: a.semester,
                            schoolYear: a.schoolYear,
                            subjectCodes: [a.subjectCode, b.subjectCode],
                            classA: { subjectCode: a.subjectCode, time: a.timeDisplay, section: a.section },
                            classB: { subjectCode: b.subjectCode, time: b.timeDisplay, section: b.section },
                            message: `Room conflict in ${a.room}: double-booked for ${a.subjectCode} (Section ${a.section}) and ${b.subjectCode} (Section ${b.section}) on ${day}.`,
                        });
                    }
                }
            }
        }
    }

    const hasConflicts = conflicts.length > 0;
    const generalMessage = hasConflicts
        ? `${conflicts.length} Schedule Conflict${conflicts.length > 1 ? 's' : ''} Detected`
        : 'No Schedule Conflicts Detected';
    const generalDescription = hasConflicts
        ? conflicts.map((c) => c.message).slice(0, 3).join(' ') + (conflicts.length > 3 ? ` (+${conflicts.length - 3} more)` : '')
        : 'All assigned schedules passed validation.';

    return {
        hasConflicts,
        conflictsCount: conflicts.length,
        conflicts,
        status: {
            hasConflicts,
            message: generalMessage,
            description: generalDescription,
        },
    };
}
