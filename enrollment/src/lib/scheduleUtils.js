const YEAR_ALIASES = {
  1: "1",
  "1st": "1",
  first: "1",
  "first year": "1",
  2: "2",
  "2nd": "2",
  second: "2",
  "second year": "2",
  3: "3",
  "3rd": "3",
  third: "3",
  "third year": "3",
  4: "4",
  "4th": "4",
  fourth: "4",
  "fourth year": "4",
};

const SEMESTER_ALIASES = {
  1: "1st",
  "1st": "1st",
  first: "1st",
  "first semester": "1st",
  2: "2nd",
  "2nd": "2nd",
  second: "2nd",
  "second semester": "2nd",
};

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function normalizeYearValue(value) {
  const normalized = YEAR_ALIASES[normalizeText(value)];
  return normalized || null;
}

export function normalizeSemesterValue(value) {
  const normalized = SEMESTER_ALIASES[normalizeText(value)];
  return normalized || null;
}

export function normalizeSectionValue(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized || null;
}

export function parseSectionName(sectionName) {
  const normalized = normalizeSectionValue(sectionName);
  if (!normalized) {
    return { year: null, section: null };
  }

  const yearSectionMatch = normalized.match(/^(?:[A-Z]+-)?(\d+)([A-Z]+)$/);
  if (yearSectionMatch) {
    return {
      year: yearSectionMatch[1],
      section: yearSectionMatch[2],
    };
  }

  return {
    year: null,
    section: normalized,
  };
}

export function buildScheduleKey({ year, semester, section }) {
  const normalizedYear = normalizeYearValue(year);
  const normalizedSemester = normalizeSemesterValue(semester);
  const normalizedSection = normalizeSectionValue(section);

  if (normalizedYear && normalizedSemester && normalizedSection) {
    return `${normalizedYear}::${normalizedSemester}::${normalizedSection}`;
  }

  if (normalizedSection) {
    return `section::${normalizedSection}`;
  }

  return null;
}

export function buildStudentScheduleKeys(student) {
  const parsedSection = parseSectionName(student?.section);
  const primaryKey = buildScheduleKey({
    year: student?.year ?? parsedSection.year,
    semester: student?.semester,
    section: student?.section,
  });
  const fallbackKey = normalizeSectionValue(student?.section)
    ? `section::${normalizeSectionValue(student.section)}`
    : null;

  return [...new Set([primaryKey, fallbackKey].filter(Boolean))];
}

function resolveScheduleRowKey(schedule, row) {
  const sectionName = row?.sectionName ?? row?.section ?? schedule?.sectionName ?? schedule?.section;
  const parsedSection = parseSectionName(sectionName);

  return buildScheduleKey({
    year: row?.year ?? schedule?.year ?? parsedSection.year,
    semester: row?.semester ?? row?.sem ?? schedule?.semester,
    section: row?.section ?? parsedSection.section,
  });
}

export function buildScheduleMap(scheduleDocuments) {
  const scheduleMap = new Map();
  const sortedSchedules = [...(Array.isArray(scheduleDocuments) ? scheduleDocuments : [])].sort((left, right) => {
    const leftTime = new Date(left?.generated_at ?? left?.createdAt ?? 0).getTime();
    const rightTime = new Date(right?.generated_at ?? right?.createdAt ?? 0).getTime();
    return rightTime - leftTime;
  });

  for (const schedule of sortedSchedules) {
    const classes = Array.isArray(schedule?.classes) ? schedule.classes : [];
    const groupedRows = new Map();

    for (const row of classes) {
      const key = resolveScheduleRowKey(schedule, row);
      if (!key) continue;

      if (!groupedRows.has(key)) {
        groupedRows.set(key, []);
      }

      groupedRows.get(key).push(row);
    }

    groupedRows.forEach((rows, key) => {
      if (!scheduleMap.has(key)) {
        scheduleMap.set(key, rows);
      }
    });
  }

  return scheduleMap;
}

export function formatScheduleTimeValue(value) {
  if (value === null || value === undefined || value === "") return "—";

  if (typeof value === "number" && Number.isFinite(value)) {
    const hours = Math.floor(value / 60);
    const minutes = value % 60;
    const period = hours >= 12 ? "PM" : "AM";
    const normalizedHours = hours % 12 === 0 ? 12 : hours % 12;
    return `${String(normalizedHours).padStart(2, "0")}:
${String(minutes).padStart(2, "0")} ${period}`.replace("\n", "");
  }

  return String(value);
}

export function formatScheduleTimeRange(startTime, endTime) {
  return `${formatScheduleTimeValue(startTime)} - ${formatScheduleTimeValue(endTime)}`;
}