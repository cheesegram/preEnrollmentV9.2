import mongoose from "mongoose";
import { subjects } from "../data/mockDb";

const curriculumSchema = new mongoose.Schema(
    {
        academic_year: { type: String, required: true },
        program:  { type: String, required: true },
        year_level:  { type: Number, required: true },
        semester:  { type: Number, required: true },
        subjects: [
            {
                subject_code:  { type: String, required: true },
                split: [{ type: String }] // ['Lecture', 'Laborattory']
            }
        ]
    }, 
    { collection: "curriculums" }
);

export default mongoose.model("Curriculum", curriculumSchema);
