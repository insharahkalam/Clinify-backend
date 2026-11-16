import Subscription from "../models/Subscription.js";
import Patient from "../models/Patient.js";
import { getPlans } from "./plans.js";

const DAY = 24 * 60 * 60 * 1000;

// Abhi clinic kaunse plan par hai? (Pro ki muddat khatam ho to Free maana jata hai)
export const getCurrentPlan = async () => {
    const find = () =>
        Subscription.findOneAndUpdate(
            { key: "main" },
            { $setOnInsert: { plan: "free" } },
            { upsert: true, new: true }
        );

    let subscription;
    try {
        subscription = await find();
    } catch (error) {
        // Do requests ek saath pehli dafa aayen to ek ko duplicate error aata hai, dobara try karo
        if (error.code === 11000) subscription = await find();
        else throw error;
    }

    const now = new Date();
    const expired = subscription.plan === "pro" && !!subscription.expiresAt && subscription.expiresAt <= now;
    const planId = subscription.plan === "pro" && !expired ? "pro" : "free";

    return { planId, config: getPlans()[planId], subscription, expired };
};

// Kitne patients ho chuke aur kitne aur ban sakte hain
export const getPatientUsage = async (config) => {
    const used = await Patient.countDocuments();
    const max = config.maxPatients;

    return {
        used,
        max,
        remaining: max === null ? null : Math.max(0, max - used),
        canAdd: max === null || used < max,
    };
};

// Admin ko dikhane ke liye poori maloomat
export const buildInfo = async ({ planId, config, subscription, expired }) => {
    const patients = await getPatientUsage(config);
    const expiresAt = subscription.expiresAt || null;

    const daysLeft =
        planId === "pro" && expiresAt ? Math.max(0, Math.ceil((new Date(expiresAt) - new Date()) / DAY)) : null;

    return {
        plan: planId,
        name: config.name,
        storedPlan: subscription.plan,
        expired,
        expiresAt,
        daysLeft,
        features: config.features,
        maxPatients: config.maxPatients,
        patients,
        plans: Object.values(getPlans()),
        history: [...(subscription.history || [])]
            .slice(-10)
            .reverse()
            .map((h) => ({ plan: h.plan, months: h.months ?? null, at: h.at })),
    };
};