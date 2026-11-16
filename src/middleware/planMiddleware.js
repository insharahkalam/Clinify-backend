import Patient from "../models/Patient.js";
import { getCurrentPlan } from "../utils/subscription.js";

// Kisi route ko plan ke feature se lock karna: requireFeature("ai")
export const requireFeature = (feature) => async (req, res, next) => {
    try {
        const { planId, config } = await getCurrentPlan();

        if (!config.features[feature]) {
            return res.status(403).json({
                message: `Ye feature Pro plan mein hai. Abhi clinic ${config.name} plan par hai.`,
                code: "FEATURE_LOCKED",
                feature,
                plan: planId,
            });
        }

        next();
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Naya patient banane se pehle plan ki limit check karna
export const checkPatientLimit = async (req, res, next) => {
    try {
        const { planId, config } = await getCurrentPlan();

        if (config.maxPatients !== null) {
            const used = await Patient.countDocuments();

            if (used >= config.maxPatients) {
                return res.status(403).json({
                    message: `${config.name} plan mein sirf ${config.maxPatients} patients ho sakte hain. Pro plan mein upgrade karein.`,
                    code: "PATIENT_LIMIT_REACHED",
                    plan: planId,
                    limit: config.maxPatients,
                    used,
                });
            }
        }

        next();
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};