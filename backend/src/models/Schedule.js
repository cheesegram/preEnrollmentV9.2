import mongoose from 'mongoose';

const scheduleSchema = new mongoose.Schema({
  program: { type: String, trim: true },
  year: { type: String, trim: true },
  section: { type: String, trim: true },
  curriculum_id: { type: String, required: true }, // "curriculum_24_25"
  academic_year: { type: String, required: true },
  semester: { type: mongoose.Schema.Types.Mixed, required: true },
  status: { type: String, enum: ['Draft', 'Published'], default: 'Draft' },
  generated_at: { type: Date, default: Date.now },
  updated_at: { type: Date },
  classes: { type: Array, required: true }
});

export default mongoose.model('Schedule', scheduleSchema);
