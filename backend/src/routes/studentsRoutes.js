import express from "express";
import {
  batchEnrollFromApplicants,
  batchEnrollPreview,
  createStudent,
  deleteStudent,
  enrollFromApplicant,
  getAllStudents,
  getPendingApplicants,
  getApplicantsForEnrollment,
  getStudentById,
  getStudentSections,
  getStudentBySection,
  importStudents,
  blockImportPreview,
  updateStudent,
  moveStudentsToSection,
  exportStudentPdf,
  exportSectionPdf,
} from "../controllers/studentsController.js";

const router = express.Router();

router.get("/", getAllStudents);
router.get("/pending", getPendingApplicants);
router.get("/applicants", getApplicantsForEnrollment);
router.get("/sections", getStudentSections);
router.get("/export-section-pdf", exportSectionPdf);
router.get("/section/:section", getStudentBySection);
router.post("/enroll", enrollFromApplicant);
router.post("/batch-enroll-preview", batchEnrollPreview);
router.post("/batch-enroll", batchEnrollFromApplicants);
router.post("/import", importStudents);
router.post("/block-import-preview", blockImportPreview);
router.get("/:id/export-pdf", exportStudentPdf);
router.get("/:id", getStudentById);
router.post("/", createStudent);
router.put("/:id", updateStudent);
router.post("/move-section", moveStudentsToSection);
router.delete("/:id", deleteStudent);

export default router;