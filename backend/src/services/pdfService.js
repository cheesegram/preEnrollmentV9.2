import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ============================================================================
 * CERTIFICATE OF REGISTRATION (COR) - PDF GENERATION SERVICE
 * ============================================================================
 * This service renders the official Certificate of Registration (COR) matching
 * the standard college template layout with student details, schedule table,
 * school fees, RA 10931 eligibility, payment scheme, and signatures.
 *
 * All editable text strings and default fee structures are defined in the
 * CONFIGURATION block below for easy customization.
 * ============================================================================
 */

// ============================================================================
// CONFIGURATION: School Information, Default Fees, and Legal Texts
// (Admin / Developers can adjust these values as needed)
// ============================================================================
export const COR_CONFIG = {
  school: {
    name: "BALIWAG POLYTECHNIC COLLEGE",
    address: "Baliwag, Bulacan",
    title: "CERTIFICATE OF REGISTRATION",
    collegePledgeName: "the Institution",
    defaultRegistrarName: "REGISTRAR",
  },
  // Default School Fees structure
  schoolFees: {
    tuition: 5400.0,
    misc: 2700.0,
    miscBreakdown: [
      { label: "Athletics:", amount: 100.0 },
      { label: "Cultural:", amount: 100.0 },
      { label: "Devt:", amount: 400.0 },
      { label: "Guidance:", amount: 200.0 },
      { label: "Handbook:", amount: 0.0 },
      { label: "Library:", amount: 500.0 },
      { label: "Medical/Dental:", amount: 250.0 },
      { label: "Registration:", amount: 500.0 },
      { label: "Com.Outreach:", amount: 450.0 },
      { label: "ALCU:", amount: 200.0 },
    ],
    computerFee: 2000.0,
    idCardFee: 0.0,
    labFee: 0.0,
  },
  // Default Payment Scheme values
  paymentScheme: {
    totalAssessment: 10100.0,
    downPayment: 0.0,
    eligibleForRA10931: 9450.0,
    balance: 0.0,
    subsidizedByLGU: 650.0,
    backAccounts: 0.0,
  },
  // Legal disclaimer and pledge texts
  texts: {
    optOutDisclaimer:
      "I am aware of the benefits and responsibilities of R.A. 10931. However, I voluntarily opt out by paying my tuition and school fees to BTech.",
    admissionPledge:
      "Upon my admission to the Baliwag Polytechnic College, I hereby pledge to abide by and comply with all rules and regulations governing student's academic performance, conduct and discipline for the attainment of the vision and mission of the institution.",
  },
};

/**
 * Format currency numbers with commas and 2 decimals (e.g. 5,400.00)
 */
function formatCurrency(num) {
  const val = Number(num) || 0;
  return val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Format minute-based time or string into HH:MM AM/PM
 */
function formatDisplayTime(timeVal) {
  if (timeVal == null || timeVal === "") return "";
  if (typeof timeVal === "number" && Number.isFinite(timeVal)) {
    const hours = Math.floor(timeVal / 60) % 24;
    const minutes = timeVal % 60;
    const period = hours >= 12 ? "PM" : "AM";
    const normalizedHours = hours % 12 === 0 ? 12 : hours % 12;
    return `${normalizedHours}:${String(minutes).padStart(2, "0")}${period}`;
  }
  return String(timeVal).trim();
}

/**
 * Format schedule time range (e.g., 9:00AM-11:00AM)
 */
function formatTimeRange(startTime, endTime) {
  const start = formatDisplayTime(startTime);
  const end = formatDisplayTime(endTime);
  if (start && end) return `${start}-${end}`;
  if (start) return start;
  return "";
}

/**
 * Normalize and parse day values
 */
function formatDays(classItem) {
  if (Array.isArray(classItem?.days) && classItem.days.length > 0) {
    return classItem.days.join(", ");
  }
  return String(classItem?.day ?? "").trim();
}

/**
 * Draw a single checkbox with optional checkmark
 */
function drawCheckbox(doc, x, y, size, checked, label, labelFont = "Helvetica", labelSize = 7.5) {
  doc.save();
  doc.lineWidth(0.8);
  doc.strokeColor("#000000");
  doc.rect(x, y, size, size).stroke();

  if (checked) {
    // Draw tick mark
    doc.lineWidth(1.2);
    doc.moveTo(x + 2, y + size / 2)
      .lineTo(x + size / 2 - 0.5, y + size - 2)
      .lineTo(x + size - 1.5, y + 2)
      .stroke();
  }

  if (label) {
    doc.font(labelFont).fontSize(labelSize).fillColor("#000000");
    doc.text(label, x + size + 3, y + 0.5, { lineBreak: false });
  }
  doc.restore();
}

/**
 * Render a complete Certificate of Registration (COR) page for a student.
 */
export function renderStudentCORPage(doc, student, scheduleClasses = [], subjectsMap = new Map(), customConfig = {}) {
  const cfg = {
    school: { ...COR_CONFIG.school, ...customConfig.school },
    schoolFees: { ...COR_CONFIG.schoolFees, ...customConfig.schoolFees },
    paymentScheme: { ...COR_CONFIG.paymentScheme, ...customConfig.paymentScheme },
    texts: { ...COR_CONFIG.texts, ...customConfig.texts },
  };

  const leftMargin = 22;
  const rightMargin = 590;
  const contentWidth = rightMargin - leftMargin; // 568 pt

  doc.font("Helvetica");

  // =========================================================================
  // 1. HEADER SECTION
  // =========================================================================
  const headerTop = 20;

  // 1.1 Left Box: "OFFICIALLY ENROLLED" & "The Registrar" (both enclosed inside the box)
  doc.save();
  doc.lineWidth(1.2).strokeColor("#000000");
  doc.roundedRect(leftMargin, headerTop, 134, 34, 4).stroke();
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#000000");
  doc.text("OFFICIALLY ENROLLED", leftMargin, headerTop + 6, {
    width: 134,
    align: "center",
  });
  doc.font("Helvetica").fontSize(8).fillColor("#333333");
  doc.text("The Registrar", leftMargin, headerTop + 20, {
    width: 134,
    align: "center",
  });
  doc.restore();

  // 1.2 Center: School Name, Address, Certificate of Registration
  doc.save();
  doc.font("Helvetica-Bold").fontSize(10.5).fillColor("#333333");
  doc.text(cfg.school.name, 160, headerTop, { width: 250, align: "center" });
  doc.font("Helvetica").fontSize(7.5).fillColor("#555555");
  doc.text(cfg.school.address, 160, headerTop + 13, { width: 250, align: "center" });
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#000000");
  doc.text(cfg.school.title, 160, headerTop + 24, { width: 250, align: "center" });
  doc.restore();

  // 1.3 Right Box: "STUDENT'S COPY" & Timestamp / User
  const rightBoxX = rightMargin - 120;
  doc.save();
  doc.lineWidth(1.2).strokeColor("#000000");
  doc.roundedRect(rightBoxX, headerTop, 120, 20, 4).stroke();
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#000000");
  doc.text("STUDENT'S COPY", rightBoxX, headerTop + 5, {
    width: 120,
    align: "center",
  });

  // Timestamp formatting
  const now = new Date();
  const dateStr = `${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}/${String(now.getFullYear()).slice(-2)}`;
  let hours = now.getHours();
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12 || 12;
  const timeStr = `${String(hours).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} ${ampm}`;
  const timestampText = `${dateStr} ${timeStr} | ${cfg.school.defaultRegistrarName}`;

  doc.font("Helvetica").fontSize(7.5).fillColor("#000000");
  doc.text(timestampText, rightBoxX - 40, headerTop + 25, {
    width: 160,
    align: "right",
  });
  doc.restore();

  // =========================================================================
  // 2. STUDENT BASIC INFORMATION
  // =========================================================================
  // Added more breathing space below header
  const infoTop = 64;

  // Extract student details
  const isSummer = String(student?.semester ?? "").toLowerCase().includes("summer");
  const semesterStr = isSummer ? "" : String(student?.semester ?? "2nd").toUpperCase().replace("SEMESTER", "").trim();
  const rawSchoolYear = String(student?.schoolYear ?? "2025-2026").trim();
  const syParts = rawSchoolYear.split("-").map((s) => s.trim().replace(/\D/g, ""));
  const syStart = syParts[0] ? syParts[0].slice(-2) : "25";
  const syEnd = syParts[1] ? syParts[1].slice(-2) : "26";
  const courseStr = String(student?.course || student?.program || "BSIT").toUpperCase().trim() || "BSIT";
  const yearLevelStr = String(student?.year ?? "1").trim();
  const sectionStr = String(student?.section ?? "A").trim().replace(/^[A-Z]+-?\d*/i, "") || String(student?.section ?? "A");
  const studentNoStr = String(student?.studentNumber ?? "").trim();

  // 2.1 Academic Line
  doc.save();
  doc.font("Helvetica-Bold").fontSize(8);
  doc.text(semesterStr, leftMargin + 6, infoTop);
  doc.lineWidth(0.6).moveTo(leftMargin + 2, infoTop + 9).lineTo(leftMargin + 28, infoTop + 9).stroke();

  doc.font("Helvetica").fontSize(7.5);
  doc.text("Semester/Summer", leftMargin + 30, infoTop);

  // Line for Summer class (between Semester/Summer and AY 20)
  doc.lineWidth(0.6).moveTo(leftMargin + 95, infoTop + 9).lineTo(leftMargin + 130, infoTop + 9).stroke();
  if (isSummer) {
    doc.font("Helvetica-Bold").fontSize(7.5);
    doc.text("SUMMER", leftMargin + 97, infoTop);
    doc.font("Helvetica").fontSize(7.5);
  }

  doc.text(",AY 20", leftMargin + 133, infoTop);
  doc.font("Helvetica-Bold");
  doc.text(syStart, leftMargin + 158, infoTop);
  doc.lineWidth(0.6).moveTo(leftMargin + 155, infoTop + 9).lineTo(leftMargin + 172, infoTop + 9).stroke();

  doc.font("Helvetica");
  doc.text("-20", leftMargin + 175, infoTop);
  doc.font("Helvetica-Bold");
  doc.text(syEnd, leftMargin + 190, infoTop);
  doc.lineWidth(0.6).moveTo(leftMargin + 188, infoTop + 9).lineTo(leftMargin + 205, infoTop + 9).stroke();

  doc.font("Helvetica");
  doc.text("Course", leftMargin + 210, infoTop);
  doc.font("Helvetica-Bold");
  doc.text(courseStr, leftMargin + 242, infoTop);
  doc.lineWidth(0.6).moveTo(leftMargin + 238, infoTop + 9).lineTo(leftMargin + 276, infoTop + 9).stroke();

  doc.font("Helvetica");
  doc.text("Year Level", leftMargin + 282, infoTop);
  doc.font("Helvetica-Bold");
  doc.text(yearLevelStr, leftMargin + 324, infoTop);
  doc.lineWidth(0.6).moveTo(leftMargin + 320, infoTop + 9).lineTo(leftMargin + 336, infoTop + 9).stroke();

  doc.font("Helvetica");
  doc.text("Section", leftMargin + 342, infoTop);
  doc.font("Helvetica-Bold");
  doc.text(sectionStr, leftMargin + 374, infoTop);
  doc.lineWidth(0.6).moveTo(leftMargin + 370, infoTop + 9).lineTo(leftMargin + 386, infoTop + 9).stroke();

  doc.font("Helvetica");
  doc.text("Student No.", leftMargin + 394, infoTop);
  doc.font("Helvetica-Bold");
  doc.text(studentNoStr, leftMargin + 446, infoTop);
  doc.lineWidth(0.6).moveTo(leftMargin + 442, infoTop + 9).lineTo(rightMargin, infoTop + 9).stroke();
  doc.restore();

  // 2.2 Right Checkbox Groups: 3 Distinct Separated Boxes Matching Layout
  const nameY = infoTop + 18;
  const boxTopY = nameY - 2;

  // Box 3: Student Classification (Far right, tall box spanning Line 2 and Line 3)
  const box3W = 68;
  const box3X = rightMargin - box3W;
  const box3H = 48;

  // Box 2: Section (Blocked / Irregular Section, top row beside Box 3)
  const box2W = 76;
  const box2X = box3X - box2W - 4;
  const box12H = 24;

  // Box 1: Gender (Female / Male, top row beside Box 2)
  const box1W = 46;
  const box1X = box2X - box1W - 4;

  doc.save();
  doc.lineWidth(0.8).strokeColor("#000000");

  // Draw 3 separate boxes
  doc.rect(box1X, boxTopY, box1W, box12H).stroke();
  doc.rect(box2X, boxTopY, box2W, box12H).stroke();
  doc.rect(box3X, boxTopY, box3W, box3H).stroke();

  const isFemale = String(student?.gender ?? "").toLowerCase().startsWith("f");
  const isMale = String(student?.gender ?? "").toLowerCase().startsWith("m");
  const isBlock = String(student?.status ?? "").toLowerCase() === "block" || String(student?.status ?? "").toLowerCase() === "enrolled";
  const isIrreg = String(student?.status ?? "").toLowerCase() === "irregular";

  const applicantType = String(student?.applicantType ?? "").toLowerCase();
  const isNew = applicantType.includes("new") || (String(student?.year) === "1" && String(student?.semester).includes("1"));
  const isOld = !isNew && !applicantType.includes("transfer") && !applicantType.includes("return");
  const isTransferee = applicantType.includes("transfer");
  const isReturnee = applicantType.includes("return");

  // Box 1 Content: Gender
  drawCheckbox(doc, box1X + 4, boxTopY + 3, 7, isFemale, "Female", "Helvetica", 7);
  drawCheckbox(doc, box1X + 4, boxTopY + 13, 7, isMale, "Male", "Helvetica", 7);

  // Box 2 Content: Section
  drawCheckbox(doc, box2X + 4, boxTopY + 3, 7, isBlock, "Blocked Section", "Helvetica", 6.8);
  drawCheckbox(doc, box2X + 4, boxTopY + 13, 7, isIrreg, "Irregular Section", "Helvetica", 6.8);

  // Box 3 Content: Student Classification
  drawCheckbox(doc, box3X + 4, boxTopY + 3.5, 6.5, isNew, "New Student", "Helvetica", 6.5);
  drawCheckbox(doc, box3X + 4, boxTopY + 14.5, 6.5, isOld, "Old Student", "Helvetica", 6.5);
  drawCheckbox(doc, box3X + 4, boxTopY + 25.5, 6.5, isTransferee, "Transferee", "Helvetica", 6.5);
  drawCheckbox(doc, box3X + 4, boxTopY + 36.5, 6.5, isReturnee, "Returnee", "Helvetica", 6.5);
  doc.restore();

  // 2.3 Name Fields (Line 2 of student details)
  const surname = String(student?.lastName ?? "").toUpperCase().trim();
  const firstName = `${String(student?.firstName ?? "").trim()} ${student?.suffix ? String(student?.suffix).trim() : ""}`.toUpperCase().trim();
  const middleName = String(student?.middleName ?? "").toUpperCase().trim();

  doc.save();
  // Values
  doc.font("Helvetica-Bold").fontSize(8.5);
  doc.text(surname, leftMargin + 45, nameY);
  doc.text(firstName, leftMargin + 140, nameY);
  doc.text(middleName, leftMargin + 245, nameY);

  // Line (ends right before Box 1)
  const nameLineY = nameY + 10;
  doc.lineWidth(0.6).moveTo(leftMargin, nameLineY).lineTo(box1X - 4, nameLineY).stroke();

  // Labels below Line 2
  doc.font("Helvetica").fontSize(6.8);
  doc.text("NAME(PRINT) Surname", leftMargin + 2, nameLineY + 2);
  doc.text("First Name", leftMargin + 140, nameLineY + 2);
  doc.text("Middle Name", leftMargin + 245, nameLineY + 2);
  doc.restore();

  // 2.4 Address & Contact Fields (Line 3 of student details, runs underneath Box 1 & 2 up to Box 3)
  const addrY = nameLineY + 17;
  const houseNo = String(student?.permanentHouse ?? student?.presentHouse ?? "").toUpperCase().trim();
  const brgy = String(student?.permanentBarangay ?? student?.presentBarangay ?? "").toUpperCase().trim();
  const city = String(student?.permanentCity ?? student?.presentCity ?? "").toUpperCase().trim();
  const province = String(student?.permanentProvince ?? student?.presentProvince ?? "").toUpperCase().trim();
  const zip = String(student?.permanentZip ?? student?.presentZip ?? "").toUpperCase().trim();
  const contact = String(student?.contactNumber ?? "").toUpperCase().trim();
  const email = String(student?.email ?? "").toLowerCase().trim();

  doc.save();
  doc.font("Helvetica-Bold").fontSize(7);
  doc.text(houseNo, leftMargin + 2, addrY);
  doc.text(brgy, leftMargin + 38, addrY);
  doc.text(city, leftMargin + 120, addrY);
  doc.text(province, leftMargin + 185, addrY);
  doc.text(zip, leftMargin + 242, addrY);
  doc.text(contact, leftMargin + 280, addrY);
  doc.text(email, leftMargin + 360, addrY, { width: (box3X - 6) - (leftMargin + 360), lineBreak: false });

  // Underline (ends right at Box 3)
  const addrLineY = addrY + 9;
  doc.lineWidth(0.6).moveTo(leftMargin, addrLineY).lineTo(box3X - 4, addrLineY).stroke();

  // Labels below Line 3
  doc.font("Helvetica").fontSize(6.5);
  doc.text("Street No.", leftMargin + 2, addrLineY + 2);
  doc.text("Barangay/District", leftMargin + 38, addrLineY + 2);
  doc.text("Town/City", leftMargin + 120, addrLineY + 2);
  doc.text("Province", leftMargin + 185, addrLineY + 2);
  doc.text("Zip Code", leftMargin + 242, addrLineY + 2);
  doc.text("Contact No.", leftMargin + 280, addrLineY + 2);
  doc.text("Email Address", leftMargin + 360, addrLineY + 2);
  doc.restore();

  // =========================================================================
  // 3. SUBJECTS ENROLLED TABLE (LEFT) & SCHOOL FEES (RIGHT)
  // =========================================================================
  // Added extra vertical space before the tables
  const tablesTop = addrLineY + 16;

  // Reduced School Fees table width to eliminate excess whitespace and widened Subjects table
  const rightTableW = 124; // Compact school fees width
  const tableGap = 6;
  const leftTableW = contentWidth - rightTableW - tableGap; // 568 - 124 - 6 = 438 pt (+33 pt wider!)
  const rightTableX = leftMargin + leftTableW + tableGap;

  // -------------------------------------------------------------------------
  // 3.1 LEFT: SUBJECTS ENROLLED TABLE (Extended width to prevent text wrap/overlap)
  // -------------------------------------------------------------------------
  const colDefs = [
    { key: "code", label: "SUBJECT CODE", w: 60, align: "left" },
    { key: "unit", label: "UNIT", w: 22, align: "center" },
    { key: "hrs", label: "HRS", w: 22, align: "center" },
    { key: "time", label: "TIME", w: 80, align: "left" },
    { key: "days", label: "DAYS", w: 48, align: "left" },
    { key: "room", label: "ROOM", w: 46, align: "left" },
    { key: "section", label: "SECTION", w: 36, align: "center" },
    { key: "prof", label: "INSTRUCTOR'S\nNAME/ SIGNATURE", w: 124, align: "left" },
  ];

  doc.save();
  doc.lineWidth(0.8).strokeColor("#000000");

  // Title row
  doc.rect(leftMargin, tablesTop, leftTableW, 14).stroke();
  doc.font("Helvetica-Bold").fontSize(7.5);
  doc.text("SUBJECTS ENROLLED", leftMargin, tablesTop + 3.5, {
    width: leftTableW,
    align: "center",
  });

  // Column Header row
  const headerRowY = tablesTop + 14;
  const headerRowH = 18;
  doc.rect(leftMargin, headerRowY, leftTableW, headerRowH).stroke();

  let curX = leftMargin;
  colDefs.forEach((col, idx) => {
    if (idx > 0) {
      doc.moveTo(curX, headerRowY).lineTo(curX, headerRowY + headerRowH).stroke();
    }
    doc.font("Helvetica-Bold").fontSize(5.8);
    const textY = col.label.includes("\n") ? headerRowY + 2 : headerRowY + 5;
    doc.text(col.label, curX + 2, textY, { width: col.w - 4, align: col.align });
    curX += col.w;
  });

  // Data rows
  const rowStartY = headerRowY + headerRowH;
  const defaultRowH = 14;
  const totalDisplayRows = 10; // Fixed grid height to maintain document proportion
  let currentY = rowStartY;

  let totalUnits = 0;
  let totalHours = 0;

  // Prepare table rows from student's schedule classes
  const formattedRows = [];
  const studentSectionName = `${student?.year ?? ""}-${student?.section ?? ""}`.trim();

  (scheduleClasses || []).forEach((c) => {
    const code = String(c?.subjectCode ?? c?.code ?? "").trim();
    const subjectInfo = subjectsMap.get(code.toUpperCase()) || {};
    const lectureUnits = Number(subjectInfo?.lecture ?? 0);
    const labUnits = Number(subjectInfo?.laboratory ?? 0);
    const subjectUnits = Number(subjectInfo?.units ?? (lectureUnits + labUnits || 3));
    const hours = lectureUnits + labUnits || (c?.durationMinutes ? c.durationMinutes / 60 : subjectUnits);

    totalUnits += subjectUnits;
    totalHours += hours;

    const timeRange = formatTimeRange(c?.startTime, c?.endTime) || String(c?.time ?? "TBA");
    const dayStr = formatDays(c) || "TBA";
    const roomStr = String(c?.roomName ?? c?.roomId ?? c?.room ?? "TBA").trim();
    const secStr = String(c?.sectionName ?? c?.section ?? studentSectionName).trim();
    const profStr = String(c?.profName ?? c?.instructor ?? "").trim();

    formattedRows.push({
      code,
      unit: String(subjectUnits),
      hrs: String(hours),
      time: timeRange,
      days: dayStr,
      room: roomStr,
      section: secStr,
      prof: profStr,
    });
  });

  // Render rows
  for (let i = 0; i < totalDisplayRows; i++) {
    const row = formattedRows[i];
    const rowH = defaultRowH;

    doc.rect(leftMargin, currentY, leftTableW, rowH).stroke();

    let cellX = leftMargin;
    colDefs.forEach((col, idx) => {
      if (idx > 0) {
        doc.moveTo(cellX, currentY).lineTo(cellX, currentY + rowH).stroke();
      }

      if (row) {
        doc.font("Helvetica").fontSize(6.2).fillColor("#000000");
        const val = String(row[col.key] ?? "");
        doc.text(val, cellX + 2, currentY + 3.5, { width: col.w - 4, align: col.align, lineBreak: false });
      }
      cellX += col.w;
    });

    currentY += rowH;
  }

  // Summary Row (Total Units & Total Hours)
  const summaryRowH = 13;
  doc.rect(leftMargin, currentY, leftTableW, summaryRowH).stroke();
  const unitColX = leftMargin + colDefs[0].w;
  const hrsColX = unitColX + colDefs[1].w;

  // Split lines for unit and hrs column in summary
  doc.moveTo(unitColX, currentY).lineTo(unitColX, currentY + summaryRowH).stroke();
  doc.moveTo(hrsColX, currentY).lineTo(hrsColX, currentY + summaryRowH).stroke();
  doc.moveTo(hrsColX + colDefs[2].w, currentY).lineTo(hrsColX + colDefs[2].w, currentY + summaryRowH).stroke();

  doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#000000");
  doc.text(String(totalUnits || 18), unitColX + 2, currentY + 3, {
    width: colDefs[1].w - 4,
    align: "center",
  });
  doc.text(String(totalHours || 26), hrsColX + 2, currentY + 3, {
    width: colDefs[2].w - 4,
    align: "center",
  });
  doc.restore();

  // -------------------------------------------------------------------------
  // 3.2 RIGHT: SCHOOL FEES TABLE (Reduced width)
  // -------------------------------------------------------------------------
  doc.save();
  const feeBoxH = (currentY + summaryRowH) - tablesTop;
  doc.lineWidth(0.8).strokeColor("#000000");
  doc.rect(rightTableX, tablesTop, rightTableW, feeBoxH).stroke();

  // Header
  doc.font("Helvetica-Bold").fontSize(7.5);
  doc.text("SCHOOL FEES", rightTableX, tablesTop + 3.5, { width: rightTableW, align: "center" });
  doc.lineWidth(0.6).moveTo(rightTableX, tablesTop + 14).lineTo(rightMargin, tablesTop + 14).stroke();

  let feeY = tablesTop + 17;
  const feeRowH = 9.2;

  const renderFeeRow = (label, phpVal, amount, isBold = false, indent = 0) => {
    doc.font(isBold ? "Helvetica-Bold" : "Helvetica").fontSize(6.2).fillColor("#000000");
    doc.text(label, rightTableX + 3 + indent, feeY, { width: 54 - indent });
    if (phpVal) {
      doc.text("Php", rightTableX + 58, feeY, { width: 16 });
    }
    doc.text(formatCurrency(amount), rightTableX + 74, feeY, { width: rightTableW - 77, align: "right" });
    feeY += feeRowH;
  };

  renderFeeRow("TUITION:", true, cfg.schoolFees.tuition, true);
  renderFeeRow("MISC:", true, cfg.schoolFees.misc, true);

  (cfg.schoolFees.miscBreakdown || []).forEach((item) => {
    renderFeeRow(item.label, false, item.amount, false, 6);
  });

  renderFeeRow("Computer...", true, cfg.schoolFees.computerFee, false);
  renderFeeRow("ID Card...", true, cfg.schoolFees.idCardFee, false);
  renderFeeRow("Lab Fee...", true, cfg.schoolFees.labFee, false);

  doc.restore();

  // =========================================================================
  // 4. BOTTOM SECTION: R.A. 10931 (LEFT) & PAYMENT SCHEME (RIGHT)
  // =========================================================================
  const bottomTop = currentY + summaryRowH + 6;
  const bottomBoxH = 68;
  const bottomSplitW = 235;

  // 4.1 Left Box: RA 10931 Eligibility & Opt Out Pledge
  doc.save();
  doc.lineWidth(0.8).strokeColor("#000000");
  doc.rect(leftMargin, bottomTop, bottomSplitW, bottomBoxH).stroke();

  // Checkboxes
  drawCheckbox(doc, leftMargin + 6, bottomTop + 6, 8, true, "Eligible for R.A. 10931", "Helvetica-Bold", 7);
  drawCheckbox(doc, leftMargin + 115, bottomTop + 6, 8, false, "Not qualified for Free HE", "Helvetica", 7);
  drawCheckbox(doc, leftMargin + 45, bottomTop + 18, 8, false, "Opt Out Mechanism", "Helvetica-Bold", 7);

  // Opt-out text
  doc.font("Helvetica-Oblique").fontSize(5.8).fillColor("#222222");
  doc.text(
    cfg.texts.optOutDisclaimer,
    leftMargin + 6,
    bottomTop + 29,
    { width: bottomSplitW - 12, align: "justify" }
  );

  // Signature line inside box
  const sigLineY = bottomTop + 54;
  doc.lineWidth(0.5).moveTo(leftMargin + 6, sigLineY).lineTo(leftMargin + 150, sigLineY).stroke();
  doc.moveTo(leftMargin + 160, sigLineY).lineTo(leftMargin + bottomSplitW - 8, sigLineY).stroke();

  doc.font("Helvetica").fontSize(5.5).fillColor("#000000");
  doc.text("Printed Name & Signature of Student", leftMargin + 6, sigLineY + 2);
  doc.text("Date", leftMargin + 160, sigLineY + 2);
  doc.restore();

  // 4.2 Right Box: Payment Scheme
  const payBoxX = leftMargin + bottomSplitW + 6;
  const payBoxW = contentWidth - bottomSplitW - 6;

  doc.save();
  doc.lineWidth(0.8).strokeColor("#000000");
  doc.rect(payBoxX, bottomTop, payBoxW, bottomBoxH).stroke();

  // Title
  doc.font("Helvetica-Bold").fontSize(7.5);
  doc.text("PAYMENT SCHEME", payBoxX, bottomTop + 3.5, { width: payBoxW, align: "center" });
  doc.lineWidth(0.6).moveTo(payBoxX, bottomTop + 13).lineTo(rightMargin, bottomTop + 13).stroke();

  // 2-Column Key Value grid
  let payY = bottomTop + 16;
  const payRowH = 11.5;

  const renderPayRow = (lLabel, lVal, rLabel, rVal) => {
    doc.font("Helvetica").fontSize(6.2).fillColor("#000000");
    doc.text(lLabel, payBoxX + 4, payY, { width: 100 });
    doc.text(":", payBoxX + 86, payY);
    doc.text(lVal, payBoxX + 90, payY, { width: 50, align: "right" });
    // Underline for left column value
    doc.lineWidth(0.5).strokeColor("#000000");
    doc.moveTo(payBoxX + 90, payY + 8).lineTo(payBoxX + 142, payY + 8).stroke();

    doc.text(rLabel, payBoxX + 148, payY, { width: 75 });
    doc.text(":", payBoxX + 224, payY);
    doc.text(rVal, payBoxX + 228, payY, { width: payBoxW - 232, align: "right" });
    // Underline for right column value
    doc.moveTo(payBoxX + 228, payY + 8).lineTo(payBoxX + payBoxW - 4, payY + 8).stroke();
    payY += payRowH;
  };

  const orNumber = `${studentNoStr || "202310040"}32`;
  const formattedToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  renderPayRow(
    "Total Assessment",
    formatCurrency(cfg.paymentScheme.totalAssessment),
    "DOWN PAYMENT",
    formatCurrency(cfg.paymentScheme.downPayment)
  );
  renderPayRow(
    "Eligible for RA10931",
    formatCurrency(cfg.paymentScheme.eligibleForRA10931),
    "BALANCE",
    formatCurrency(cfg.paymentScheme.balance)
  );
  renderPayRow(
    "Subsidized by LGU",
    formatCurrency(cfg.paymentScheme.subsidizedByLGU),
    "O.R. NO.",
    orNumber
  );
  renderPayRow(
    "Back Accounts/ Adjustment",
    formatCurrency(cfg.paymentScheme.backAccounts),
    "DATE",
    formattedToday
  );
  doc.restore();

  // =========================================================================
  // 5. FOOTER PLEDGE AND SIGNATURE
  // =========================================================================
  const footerTop = bottomTop + bottomBoxH + 6;

  doc.save();
  doc.font("Helvetica").fontSize(6.8).fillColor("#000000");
  doc.text(
    cfg.texts.admissionPledge,
    leftMargin + 20,
    footerTop,
    { width: contentWidth - 40, align: "center" }
  );

  // Student Signature line
  const footerSigY = footerTop + 24;
  const sigCenterX = leftMargin + contentWidth / 2;
  doc.lineWidth(0.6).moveTo(sigCenterX - 90, footerSigY).lineTo(sigCenterX + 90, footerSigY).stroke();

  doc.font("Helvetica-Oblique").fontSize(6.5).fillColor("#000000");
  doc.text("Student's Signature and Date", sigCenterX - 90, footerSigY + 2, {
    width: 180,
    align: "center",
  });
  doc.restore();
}

/**
 * Locate the BTech logo file across common workspace paths.
 */
function getBtechLogoPath() {
  const candidatePaths = [
    path.resolve(__dirname, "../../../enrollment/src/assets/btech-logo.png"),
    path.resolve(__dirname, "../../enrollment/src/assets/btech-logo.png"),
    path.resolve(process.cwd(), "enrollment/src/assets/btech-logo.png"),
    path.resolve(process.cwd(), "../enrollment/src/assets/btech-logo.png"),
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Render the back page of the Certificate of Registration (COR) containing:
 * 1. School Header & Logo
 * 2. Examination Permit (Left Table)
 * 3. Semestral-End Clearance (Right Table)
 */
export function renderCORBackPage(doc, customConfig = {}) {
  const leftMargin = 22;
  const rightMargin = 590;
  const contentWidth = rightMargin - leftMargin; // 568 pt

  doc.save();

  // =========================================================================
  // 1. HEADER: School Logo & Title
  // =========================================================================
  const headerTop = 24;
  const logoPath = getBtechLogoPath();
  const logoW = 42;
  const logoH = 42;
  const headerTextW = 210;
  const headerTotalW = logoW + 10 + headerTextW;
  const headerX = leftMargin + (contentWidth - headerTotalW) / 2;

  if (logoPath) {
    try {
      doc.image(logoPath, headerX, headerTop, { fit: [logoW, logoH] });
    } catch (e) {
      // Fallback if image failed to load
    }
  }

  const textX = headerX + logoW + 10;
  doc.font("Helvetica-Bold").fontSize(11.5).fillColor("#000000");
  doc.text("DALUBHASAANG POLITEKNIKO", textX, headerTop + 2, { lineBreak: false });
  doc.text("NG LUNGSOD NG BALIWAG", textX, headerTop + 15, { lineBreak: false });

  // Red accent line below title
  doc.lineWidth(1.2).strokeColor("#B22222");
  doc.moveTo(textX, headerTop + 29).lineTo(textX + 185, headerTop + 29).stroke();

  // Hashtag
  doc.font("Helvetica-Bold").fontSize(7.8).fillColor("#B22222");
  doc.text("#DalubhasaanKongMahal", textX, headerTop + 32, { lineBreak: false });

  // =========================================================================
  // 2. SECTION TITLES
  // =========================================================================
  const titleY = headerTop + 54;
  const leftTableX = leftMargin;
  const leftTableW = 274;
  const rightTableW = 274;
  const rightTableX = rightMargin - rightTableW; // 316
  const tableTopY = titleY + 16;
  const headerH = 26;
  const dataRowsH = 198; // Total height for data rows in both tables
  const totalTableH = headerH + dataRowsH; // 224 pt

  doc.font("Helvetica-Bold").fontSize(11).fillColor("#000000");
  doc.text("EXAMINATION PERMIT", leftTableX, titleY, { width: leftTableW, align: "center" });
  doc.text("SEMESTRAL-END CLEARANCE", rightTableX, titleY, { width: rightTableW, align: "center" });

  // =========================================================================
  // 3. LEFT TABLE: EXAMINATION PERMIT
  // =========================================================================
  const col1W = 66;
  const examColW = 52; // 4 cols * 52 = 208 pt (66 + 208 = 274)
  const examCols = ["PRELIM", "MIDTERM", "PREFINAL", "FINAL"];

  // Outer border & header background
  doc.lineWidth(0.9).strokeColor("#000000");
  doc.rect(leftTableX, tableTopY, leftTableW, totalTableH).stroke();

  // Header Col 1: SUBJECT CODE
  doc.lineWidth(0.6);
  doc.moveTo(leftTableX + col1W, tableTopY).lineTo(leftTableX + col1W, tableTopY + totalTableH).stroke();
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#000000");
  doc.text("SUBJECT\nCODE", leftTableX + 2, tableTopY + 5, { width: col1W - 4, align: "center" });

  // Header Cols 2-5: INSTRUCTOR'S INITIALS
  doc.moveTo(leftTableX + col1W, tableTopY + 13).lineTo(leftTableX + leftTableW, tableTopY + 13).stroke();
  doc.text("INSTRUCTOR'S INITIALS", leftTableX + col1W, tableTopY + 3, { width: 208, align: "center" });

  // Sub-header columns (PRELIM, MIDTERM, PREFINAL, FINAL)
  examCols.forEach((colName, i) => {
    const cx = leftTableX + col1W + i * examColW;
    if (i > 0) {
      doc.moveTo(cx, tableTopY + 13).lineTo(cx, tableTopY + totalTableH).stroke();
    }
    doc.font("Helvetica-Bold").fontSize(7).fillColor("#000000");
    doc.text(colName, cx, tableTopY + 16, { width: examColW, align: "center" });
  });

  // Header bottom dividing line
  doc.moveTo(leftTableX, tableTopY + headerH).lineTo(leftTableX + leftTableW, tableTopY + headerH).stroke();

  // 11 Subject Rows (10 empty + 1 validation row, 18 pt each)
  const leftRowH = 18;
  for (let r = 1; r <= 11; r++) {
    const rowY = tableTopY + headerH + r * leftRowH;
    if (r < 11) {
      doc.moveTo(leftTableX, rowY).lineTo(leftTableX + leftTableW, rowY).stroke();
    }
  }

  // 11th Row: VALIDATION text in bottom-left cell (horizontal centered)
  const valCellX = leftTableX;
  const valCellY = tableTopY + headerH + 10 * leftRowH;

  doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#000000");
  doc.text("VALIDATION", valCellX, valCellY + 5, { width: col1W, align: "center" });

  // Left Footer Note
  const leftFootY = tableTopY + totalTableH + 4;
  doc.font("Helvetica").fontSize(6.8).fillColor("#000000");
  doc.text("Please refer to your Certificate of Registration for the correct course codes.", leftTableX, leftFootY, {
    width: leftTableW,
    align: "left",
  });

  // =========================================================================
  // 4. RIGHT TABLE: SEMESTRAL-END CLEARANCE
  // =========================================================================
  const deptCol1W = 104;
  const deptCol2W = 90;
  const deptCol3W = 80; // 104 + 90 + 80 = 274

  const departments = [
    "NINMO OFFICE",
    "HRS/HRM CUSTODIAN",
    "LIBRARY",
    "INTERNSHIP COORD.",
    "PREFECT OF ACTIVITIES",
    "PREFECT OF DISCIPLINE",
    "GUIDANCE",
    "ADVISER",
    "PROGRAM DIRECTOR",
    "CASHIER I",
    "IGP",
    "REGISTRAR",
    "CLINIC",
    "OTHERS:",
  ];

  // Outer border
  doc.lineWidth(0.9).strokeColor("#000000");
  doc.rect(rightTableX, tableTopY, rightTableW, totalTableH).stroke();

  // Vertical column dividers
  doc.lineWidth(0.6);
  doc.moveTo(rightTableX + deptCol1W, tableTopY).lineTo(rightTableX + deptCol1W, tableTopY + totalTableH).stroke();
  doc.moveTo(rightTableX + deptCol1W + deptCol2W, tableTopY).lineTo(rightTableX + deptCol1W + deptCol2W, tableTopY + totalTableH).stroke();

  // Header Col 1: DEPARTMENT/OFFICES
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#000000");
  doc.text("DEPARTMENT/\nOFFICES", rightTableX + 2, tableTopY + 5, { width: deptCol1W - 4, align: "center" });

  // Header Col 2: SIGNATURE
  doc.text("SIGNATURE", rightTableX + deptCol1W, tableTopY + 9, { width: deptCol2W, align: "center" });

  // Header Col 3: DATE mm/dd/yy
  doc.font("Helvetica-Bold").fontSize(7.2);
  doc.text("DATE", rightTableX + deptCol1W + deptCol2W + 8, tableTopY + 9, { continued: true });
  doc.font("Helvetica").fontSize(6.2).text(" mm/dd/yy");

  // Header bottom line
  doc.moveTo(rightTableX, tableTopY + headerH).lineTo(rightTableX + rightTableW, tableTopY + headerH).stroke();

  // 14 Department Rows
  const deptRowH = dataRowsH / departments.length; // 198 / 14 = 14.1428 pt
  departments.forEach((dept, idx) => {
    const rowY = tableTopY + headerH + idx * deptRowH;
    if (idx > 0) {
      doc.moveTo(rightTableX, rowY).lineTo(rightTableX + rightTableW, rowY).stroke();
    }
    doc.font("Helvetica-Bold").fontSize(6.5).fillColor("#000000");
    doc.text(dept, rightTableX + 3, rowY + 3.5, { width: deptCol1W - 6, align: "left" });
  });

  // Right Footer Note
  const rightFootY = tableTopY + totalTableH + 4;
  doc.font("Helvetica").fontSize(6.5).fillColor("#000000");
  doc.text("Secure ", rightTableX, rightFootY, { continued: true });
  doc.font("Helvetica-Bold").text("ALL", { underline: true, continued: true });
  doc.font("Helvetica").text(" the required signatures before submitting to the Registrar's Office for the", { underline: false });
  doc.text("releasing of Grades.", rightTableX, rightFootY + 7.5, { width: rightTableW, align: "center" });

  doc.restore();
}

/**
 * Generate a single student's Certificate of Registration PDF as a Buffer (2 pages).
 */
export async function generateStudentCORPdf(student, scheduleClasses = [], subjectsList = [], customConfig = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "LETTER",
        margin: 20,
        autoFirstPage: true,
      });

      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      const subjectsMap = new Map();
      (subjectsList || []).forEach((s) => {
        const code = String(s?.subject_code ?? s?.code ?? "").toUpperCase().trim();
        if (code) subjectsMap.set(code, s);
      });

      // Page 1: Front (Certificate of Registration)
      renderStudentCORPage(doc, student, scheduleClasses, subjectsMap, customConfig);

      // Page 2: Back (Examination Permit & Clearance)
      doc.addPage({ size: "LETTER", margin: 20 });
      renderCORBackPage(doc, customConfig);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate a multi-page PDF batch containing a Certificate of Registration for each student in a section (2 pages per student).
 */
export async function generateSectionBatchCORPdf(students = [], getStudentClassesFn, subjectsList = [], customConfig = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "LETTER",
        margin: 20,
        autoFirstPage: false,
      });

      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      const subjectsMap = new Map();
      (subjectsList || []).forEach((s) => {
        const code = String(s?.subject_code ?? s?.code ?? "").toUpperCase().trim();
        if (code) subjectsMap.set(code, s);
      });

      (students || []).forEach((student) => {
        const classes = typeof getStudentClassesFn === "function" ? getStudentClassesFn(student) : [];
        // Page 1: Front
        doc.addPage({ size: "LETTER", margin: 20 });
        renderStudentCORPage(doc, student, classes, subjectsMap, customConfig);

        // Page 2: Back
        doc.addPage({ size: "LETTER", margin: 20 });
        renderCORBackPage(doc, customConfig);
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
