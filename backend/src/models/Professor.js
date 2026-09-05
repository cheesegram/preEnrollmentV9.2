import mongoose from "mongoose";

const professorSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        specializations: {
            type: [String],
            default: [],
        },
        is_full_time: { type: Boolean, default: true },
    },
    {
        collection: "professors",
    }
);

export default mongoose.model("Professor", professorSchema);