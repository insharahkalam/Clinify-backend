import mongoose from "mongoose";

// Mareez ki medical report (lab report, x-ray wagera). File Cloudinary par hoti hai,
// yahan sirf uski details save hoti hain.
const reportSchema = new mongoose.Schema(
    {
        patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        title: { type: String, required: true, trim: true },
        category: { type: String, enum: ["lab_report", "xray", "scan", "other"], default: "other" },
        notes: { type: String, trim: true, default: "" },
        file: {
            publicId: { type: String, required: true }, // Cloudinary ki pehchan (frontend ko kabhi nahi jati)
            resourceType: { type: String, enum: ["image", "raw"], required: true },
            format: { type: String },
            bytes: { type: Number },
            originalName: { type: String },
            mimeType: { type: String },
        },
    },
    { timestamps: true }
);

export default mongoose.model("Report", reportSchema);