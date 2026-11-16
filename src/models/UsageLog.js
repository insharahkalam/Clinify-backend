import mongoose from "mongoose";

// Har dafa jab koi khaas feature istemal ho, ek line yahan likhi jati hai
const usageLogSchema = new mongoose.Schema(
    {
        type: { type: String, required: true }, // symptom_check, prescription_explain, risk_flags, pdf_download
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        source: { type: String }, // AI ke liye: "ai" ya "fallback"
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

usageLogSchema.index({ createdAt: 1 });

const UsageLog = mongoose.model("UsageLog", usageLogSchema);

export default UsageLog;