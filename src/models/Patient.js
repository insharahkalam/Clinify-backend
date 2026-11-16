import mongoose from "mongoose";

const patientSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        age: { type: Number },
        gender: { type: String, enum: ["male", "female", "other"] },
        address: { type: String },
        bloodGroup: { type: String },
        medicalNotes: { type: String },
    },
    { timestamps: true }
);

const Patient = mongoose.model("Patient", patientSchema);

export default Patient;