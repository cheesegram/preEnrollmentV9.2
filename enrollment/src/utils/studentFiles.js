import * as XLSX from "xlsx";
import api from "../lib/axios";

const normalizeHeader = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, " ");

export const sanitizeFileName = (value) =>
  String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ");

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(anchor);
}

/**
 * Export a single student's official Certificate of Registration (COR) as PDF.
 */
export async function exportStudentAsPdf(student, filenameBase) {
  const identifier = student?._id || student?.studentNumber;
  if (!identifier) throw new Error("Student ID is missing");

  const response = await api.get(`/students/${identifier}/export-pdf`, {
    responseType: "blob",
  });

  const studentName = `${String(student.lastName ?? "").trim()}_${String(student.firstName ?? "").trim()}`.trim();
  const base = filenameBase || sanitizeFileName(`COR_${student.studentNumber}_${studentName}`) || "COR_Student";
  downloadBlob(new Blob([response.data], { type: "application/pdf" }), `${base}.pdf`);
}

/**
 * Export a section's batch Certificate of Registration (COR) multi-page PDF.
 */
export async function exportSectionAsPdf({ year, section, semester }, filenameBase) {
  if (!year || !section) throw new Error("Year and section are required");

  const response = await api.get("/students/export-section-pdf", {
    params: { year, section, semester },
    responseType: "blob",
  });

  const semesterSuffix = semester && semester !== "N/A" ? `-${semester}` : "";
  const base = filenameBase || sanitizeFileName(`COR_Section_${year}-${section}${semesterSuffix}`) || "COR_Section";
  downloadBlob(new Blob([response.data], { type: "application/pdf" }), `${base}.pdf`);
}

export async function parseStudentTemplateFile(file) {
  const filename = file.name.toLowerCase();
  let workbook;

  if (filename.endsWith(".xlsx")) {
    workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  } else if (filename.endsWith(".csv")) {
    workbook = XLSX.read(await file.text(), { type: "string" });
  } else {
    throw new Error("Only CSV and XLSX files are supported");
  }

  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) throw new Error("The selected file is empty");

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], {
    header: 1,
    defval: "",
    blankrows: false,
  });

  if (!rows.length) throw new Error("The selected file has no data");

  const headerMap = new Map();
  (rows[0] || []).forEach((header, index) => {
    headerMap.set(normalizeHeader(header), index);
  });

  const requiredHeaders = ["student number", "first name", "last name", "year", "semester", "status"];
  if (!requiredHeaders.every((header) => headerMap.has(header))) {
    throw new Error("Invalid student template headers");
  }

  const getCell = (row, header) => row[headerMap.get(header)] ?? "";
  const parsedStudents = rows
    .slice(1)
    .map((row) => ({
      studentNumber: String(getCell(row, "student number")).trim(),
      firstName: String(getCell(row, "first name")).trim(),
      lastName: String(getCell(row, "last name")).trim(),
      year: String(getCell(row, "year")).trim(),
      semester: String(getCell(row, "semester")).trim(),
      status: String(getCell(row, "status")).trim() || "Enrolled",
    }))
    .filter((student) => student.studentNumber);

  if (!parsedStudents.length) throw new Error("No student rows found in file");
  return parsedStudents;
}

const BLOCK_APPLICANT_REQUIRED_HEADERS = [
  "applicantid",
  "firstname",
  "lastname",
  "year",
  "semester",
];

/**
 * Parse an uploaded block-applicant file (CSV or XLSX) that follows the
 * blockApplicantTemplate column layout. The first row is treated as the
 * header row and every following row becomes an object keyed by the exact
 * header names (e.g. applicantID, firstName, lastName, ...).
 */
export async function parseBlockApplicantFile(file) {
  const filename = String(file.name ?? "").toLowerCase();
  let workbook;

  if (filename.endsWith(".xlsx")) {
    workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  } else if (filename.endsWith(".csv")) {
    workbook = XLSX.read(await file.text(), { type: "string", cellDates: true });
  } else {
    throw new Error("Only CSV and XLSX files are supported");
  }

  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) throw new Error("The selected file is empty");

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], {
    header: 1,
    defval: "",
    blankrows: false,
  });

  if (!rows.length) throw new Error("The selected file has no data");

  const headers = (rows[0] || []).map((header, index) => ({
    key: String(header ?? "").trim(),
    normalized: normalizeHeader(header),
    index,
  }));

  if (!BLOCK_APPLICANT_REQUIRED_HEADERS.every((header) =>
    headers.some((entry) => entry.normalized === header)
  )) {
    throw new Error("Invalid block applicant template headers");
  }

  const toCellString = (value) => {
    if (value == null) return "";
    if (value instanceof Date) {
      return `${value.getMonth() + 1}/${value.getDate()}/${value.getFullYear()}`;
    }
    return String(value).trim();
  };

  const parsedApplicants = rows
    .slice(1)
    .map((row) => {
      const applicant = {};
      headers.forEach(({ key, index }) => {
        if (!key) return;
        applicant[key] = toCellString(row[index]);
      });
      return applicant;
    })
    .filter((applicant) => String(applicant.applicantID ?? "").trim());

  if (!parsedApplicants.length) throw new Error("No applicant rows found in file");
  return parsedApplicants;
}
