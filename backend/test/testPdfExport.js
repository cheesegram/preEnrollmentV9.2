// mock data only, need to connect to db later
// no longer needed right??

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generateStudentCORPdf, generateSectionBatchCORPdf } from "../src/services/pdfService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testPdf() {
  const sampleStudent = {
    studentNumber: "202310040",
    firstName: "HERA MAY",
    lastName: "CABUGA",
    middleName: "GUTAS",
    course: "BSIT",
    year: "3",
    section: "A",
    semester: "2ND",
    schoolYear: "2025-2026",
    gender: "Female",
    status: "Block",
    applicantType: "Old Student",
    permanentHouse: "532",
    permanentBarangay: "DULONG MALABON",
    permanentCity: "PULILAN",
    permanentProvince: "BULACAN",
    permanentZip: "3005",
    contactNumber: "09123456789",
    email: "cabugaheramay@gmail.com",
  };

  const sampleClasses = [
    {
      subjectCode: "CAP101",
      startTime: 840, // 2:00 PM
      endTime: 1020,  // 5:00 PM
      day: "Friday",
      roomName: "203",
      sectionName: "3-A",
      profName: "F. S. Casuco",
    },
    {
      subjectCode: "GEC-TM",
      startTime: 900, // 3:00 PM
      endTime: 1080,  // 6:00 PM
      day: "Monday",
      roomName: "VR-IITI-1",
      sectionName: "3-A",
      profName: "J. S. Malapira",
    },
    {
      subjectCode: "IAS101",
      startTime: 540, // 9:00 AM
      endTime: 660,  // 11:00 AM
      day: "Monday",
      roomName: "VR-IITI-1",
      sectionName: "3-A",
      profName: "E. JERMYN",
    },
    {
      subjectCode: "IPT102",
      startTime: 660, // 11:00 AM
      endTime: 780,  // 1:00 PM
      day: "Monday",
      roomName: "COMPUTER LAB 1",
      sectionName: "3-A",
      profName: "S. MARIA JAIME CHICO",
    },
    {
      subjectCode: "SA101",
      startTime: 780, // 1:00 PM
      endTime: 900,  // 3:00 PM
      day: "Monday",
      roomName: "VR-IITI-1",
      sectionName: "3-A",
      profName: "M. ABLAZA",
    },
    {
      subjectCode: "WS101",
      startTime: 1080, // 6:00 PM
      endTime: 1200,  // 8:00 PM
      day: "Saturday",
      roomName: "VR-IITI-1",
      sectionName: "3-A",
      profName: "C. T. Labao",
    },
  ];

  const sampleSubjects = [
    { subject_code: "CAP101", title: "Capstone Project 1", lecture: 3, laboratory: 0, units: 3 },
    { subject_code: "GEC-TM", title: "The Contemporary World", lecture: 3, laboratory: 0, units: 3 },
    { subject_code: "IAS101", title: "Information Assurance and Security 1", lecture: 2, laboratory: 1, units: 3 },
    { subject_code: "IPT102", title: "Integrative Programming and Technologies 2", lecture: 2, laboratory: 1, units: 3 },
    { subject_code: "SA101", title: "Systems Administration and Maintenance", lecture: 2, laboratory: 1, units: 3 },
    { subject_code: "WS101", title: "Web Systems and Technologies 1", lecture: 2, laboratory: 1, units: 3 },
  ];

  console.log("Generating single student COR PDF...");
  const pdfBuffer = await generateStudentCORPdf(sampleStudent, sampleClasses, sampleSubjects);
  const outPath = path.join(__dirname, "sample_COR.pdf");
  fs.writeFileSync(outPath, pdfBuffer);
  console.log("Saved single COR PDF to:", outPath, `(${pdfBuffer.length} bytes)`);

  console.log("Generating batch section COR PDF...");
  const batchBuffer = await generateSectionBatchCORPdf([sampleStudent, { ...sampleStudent, studentNumber: "202310041", firstName: "JUAN", lastName: "DELA CRUZ" }], () => sampleClasses, sampleSubjects);
  const batchOutPath = path.join(__dirname, "sample_Section_COR_Batch.pdf");
  fs.writeFileSync(batchOutPath, batchBuffer);
  console.log("Saved batch section COR PDF to:", batchOutPath, `(${batchBuffer.length} bytes)`);
}

testPdf().catch(console.error);
