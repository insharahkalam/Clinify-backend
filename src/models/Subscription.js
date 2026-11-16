import mongoose from "mongoose";

// Poore clinic ki ek hi subscription hoti hai (key hamesha "main")
const subscriptionSchema = new mongoose.Schema(
    {
        key: { type: String, default: "main", unique: true },
        plan: { type: String, enum: ["free", "pro"], default: "free" },
        expiresAt: { type: Date, default: null },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        history: [
            {
                plan: { type: String, enum: ["free", "pro"] },
                months: { type: Number },
                at: { type: Date, default: Date.now },
                by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            },
        ],
    },
    { timestamps: true }
);

const Subscription = mongoose.model("Subscription", subscriptionSchema);

export default Subscription;