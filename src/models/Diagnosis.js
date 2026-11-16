import mongoose from "mongoose";

const diagnosisSchema = new mongoose.Schema(
    {
        patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
        doctor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        appointment: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment" },
        symptoms: { type: String },
        diagnosis: { type: String, required: true },
        notes: { type: String },
    },
    { timestamps: true }
);

const Diagnosis = mongoose.model("Diagnosis", diagnosisSchema);

export default Diagnosis;