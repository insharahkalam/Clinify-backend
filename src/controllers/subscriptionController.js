import User from "../models/User.js";
import Patient from "../models/Patient.js";
import Appointment from "../models/Appointment.js";
import Diagnosis from "../models/Diagnosis.js";
import Prescription from "../models/Prescription.js";
import UsageLog from "../models/UsageLog.js";
import { getCurrentPlan, getPatientUsage, buildInfo } from "../utils/subscription.js";
import { getPlans } from "../utils/plans.js";
import { monthKey } from "../utils/forecast.js";

const DAY = 24 * 60 * 60 * 1000;
const USAGE_TYPES = ["symptom_check", "prescription_explain", "risk_flags", "pdf_download"];

// Har role ke liye: kaunse features khule hain (frontend lock dikhane ke liye)
export const getFeatures = async (req, res) => {
    try {
        const current = await getCurrentPlan();
        const patients = await getPatientUsage(current.config);

        res.json({ plan: current.planId, features: current.config.features, patients });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Admin: subscription ki poori maloomat
export const getSubscription = async (req, res) => {
    try {
        const current = await getCurrentPlan();
        res.json(await buildInfo(current));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Admin: plan badalna (payment simulated hai, koi asli paisa nahi)
export const changePlan = async (req, res) => {
    try {
        const plan = req.body.plan;
        const months = Number(req.body.months || 1);
        const now = new Date();

        const current = await getCurrentPlan();
        const sub = current.subscription;

        if (plan === "pro") {
            // Pro pehle se chal raha ho to usi ki aakhri tareekh se aage barhao (renewal)
            const stillActive = current.planId === "pro" && sub.expiresAt && sub.expiresAt > now;
            const base = stillActive ? sub.expiresAt : now;

            sub.plan = "pro";
            sub.expiresAt = new Date(base.getTime() + months * 30 * DAY);
        } else {
            sub.plan = "free";
            sub.expiresAt = null;
        }

        sub.changedBy = req.user._id;
        sub.history.push({ plan, months: plan === "pro" ? months : undefined, at: now, by: req.user._id });
        if (sub.history.length > 20) sub.history = sub.history.slice(-20);
        await sub.save();

        const info = await buildInfo({
            planId: plan,
            config: getPlans()[plan],
            subscription: sub,
            expired: false,
        });

        let message = "Pro plan chalu ho gaya";
        if (plan === "free") {
            message = "Free plan par aa gaye";
            if (info.maxPatients !== null && info.patients.used > info.maxPatients) {
                message += `. Maujooda ${info.patients.used} patients rahenge, lekin naye patients tab tak nahi ban sakte jab tak ginti ${info.maxPatients} se kam na ho`;
            }
        }

        res.json({ message, subscription: info });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Usage ko { type: { total, ai, fallback } } ki shakal dena
const foldUsage = (rows) => {
    const out = {};
    USAGE_TYPES.forEach((t) => {
        out[t] = { total: 0, ai: 0, fallback: 0 };
    });

    rows.forEach((row) => {
        const { type, source } = row._id;
        out[type] ??= { total: 0, ai: 0, fallback: 0 };
        out[type].total += row.count;
        if (source === "ai") out[type].ai += row.count;
        if (source === "fallback") out[type].fallback += row.count;
    });

    return out;
};

// Admin: system ka istemal (kitna data, kaunse features kitni dafa chale)
export const getUsage = async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthDate = { $regex: `^${monthKey(now)}` };

        const current = await getCurrentPlan();
        const patientLimit = await getPatientUsage(current.config);

        const totals = {
            patients: patientLimit.used,
            doctors: await User.countDocuments({ role: "doctor" }),
            receptionists: await User.countDocuments({ role: "receptionist" }),
            appointments: await Appointment.countDocuments(),
            diagnoses: await Diagnosis.countDocuments(),
            prescriptions: await Prescription.countDocuments(),
        };

        const thisMonth = {
            newPatients: await Patient.countDocuments({ createdAt: { $gte: startOfMonth } }),
            appointments: await Appointment.countDocuments({ date: monthDate, status: { $ne: "cancelled" } }),
            diagnoses: await Diagnosis.countDocuments({ createdAt: { $gte: startOfMonth } }),
            prescriptions: await Prescription.countDocuments({ createdAt: { $gte: startOfMonth } }),
        };

        const group = { $group: { _id: { type: "$type", source: "$source" }, count: { $sum: 1 } } };
        const allRows = await UsageLog.aggregate([{ $match: {} }, group]);
        const monthRows = await UsageLog.aggregate([{ $match: { createdAt: { $gte: startOfMonth } } }, group]);

        res.json({
            plan: current.planId,
            patientLimit,
            totals,
            thisMonth,
            featureUsage: { allTime: foldUsage(allRows), thisMonth: foldUsage(monthRows) },
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};