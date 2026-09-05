import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema(
    {
        subject_id: { type: String, required: true, unique: true }, // changed _id to subject_id 
        subject_code: { type: String, required: true },
        title: { type: String, required: true }, // subject name
        lecture: { type: Number, default: 0 },
        laboratory: { type: Number, default: 0 },
        units: { type: Number },
        is_laboratory: { type: Boolean },
    },
    { 
        collection: "subjects"
    }
);

export default mongoose.model("Subject", subjectSchema);

