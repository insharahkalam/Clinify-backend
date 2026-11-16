import User from "../models/User.js";
import Appointment from "../models/Appointment.js";
import Diagnosis from "../models/Diagnosis.js";
import Prescription from "../models/Prescription.js";
import { monthKey, addMonths, trimLeadingZeros, compareTrend, linearForecast } from "../utils/forecast.js";

export const getPredictions = async (req, res) => {
    try {
        const now = new Date();
        const currentKey = monthKey(now);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Pichle 6 mukammal mahine (purana pehle), aur agla mahina
        const pastKeys = [6, 5, 4, 3, 2, 1].map((i) => monthKey(addMonths(now, -i)));
        const nextKey = monthKey(addMonths(now, 1));

        // Ek hi query se sab mahino, doctors aur status ki ginti
        const rows = await Appointment.aggregate([
            { $match: { date: { $gte: `${pastKeys[0]}-01` } } },
            {
                $group: {
                    _id: { doctor: "$doctor", month: { $substrCP: ["$date", 0, 7] }, status: "$status" },
                    count: { $sum: 1 },
                },
            },
        ]);

        const monthTotals = {}; // har mahine ki appointments (cancelled nahi)
        const perDoctor = {}; // doctor -> mahina -> { total, completed, cancelled }

        rows.forEach((row) => {
            const { doctor, month, status } = row._id;
            const id = String(doctor);
            perDoctor[id] ??= {};
            perDoctor[id][month] ??= { total: 0, completed: 0, cancelled: 0 };
            const cell = perDoctor[id][month];

            if (status === "cancelled") {
                cell.cancelled += row.count;
            } else {
                cell.total += row.count;
                monthTotals[month] = (monthTotals[month] || 0) + row.count;
                if (status === "completed") cell.completed += row.count;
            }
        });

        // ---- 1. Sab se common bimari is mahine ----
        const diagnosisRows = await Diagnosis.aggregate([
            { $match: { createdAt: { $gte: startOfMonth } } },
            { $group: { _id: { $toLower: { $trim: { input: "$diagnosis" } } }, count: { $sum: 1 } } },
            { $sort: { count: -1, _id: 1 } },
            { $limit: 5 },
        ]);
        const topDiagnosesThisMonth = diagnosisRows.map((d) => ({ name: d._id, count: d.count }));
        const mostCommonDiseaseThisMonth = topDiagnosesThisMonth[0] || null;

        // ---- 2. Agle mahine ki patient load ka andaza ----
        const history = pastKeys.map((key) => ({ month: key, count: monthTotals[key] || 0 }));
        const usable = trimLeadingZeros(history.map((h) => h.count));
        const thisMonthBooked = monthTotals[currentKey] || 0;

        let patientLoadForecast;
        if (usable.length > 0) {
            const f = linearForecast(usable);
            patientLoadForecast = {
                nextMonth: nextKey,
                predictedAppointments: f.forecast,
                trend: f.trend,
                confidence: f.confidence,
                basedOnMonths: f.basedOnMonths,
            };
        } else {
            // Pichle mahino ka data nahi, to is mahine ki booking hi andaza hai
            patientLoadForecast = {
                nextMonth: nextKey,
                predictedAppointments: thisMonthBooked,
                trend: "no-data",
                confidence: "low",
                basedOnMonths: 0,
            };
        }
        patientLoadForecast.thisMonthBooked = thisMonthBooked;
        patientLoadForecast.history = history;

        // ---- 3. Doctor performance ----
        const doctors = await User.find({ role: "doctor" }).select("name specialization");

        const prescriptionRows = await Prescription.aggregate([
            { $match: { createdAt: { $gte: startOfMonth } } },
            { $group: { _id: "$doctor", count: { $sum: 1 } } },
        ]);
        const prescriptionsByDoctor = {};
        prescriptionRows.forEach((p) => {
            prescriptionsByDoctor[String(p._id)] = p.count;
        });

        const perfKeys = [pastKeys[3], pastKeys[4], pastKeys[5], currentKey]; // pichle 3 mahine + ye mahina

        const doctorPerformance = doctors
            .map((doc) => {
                const id = String(doc._id);
                const months = perfKeys.map((key) => {
                    const cell = perDoctor[id]?.[key] || { total: 0, completed: 0, cancelled: 0 };
                    return {
                        month: key,
                        total: cell.total,
                        completed: cell.completed,
                        cancelled: cell.cancelled,
                        completionRate: cell.total > 0 ? Math.round((cell.completed / cell.total) * 100) : 0,
                    };
                });

                // Trend: pichle do mukammal mahino ka mawazna (ye mahina adhoora hai)
                const trend = compareTrend(months[1].total, months[2].total);

                return {
                    doctorId: doc._id,
                    name: doc.name,
                    specialization: doc.specialization || "",
                    trend,
                    prescriptionsThisMonth: prescriptionsByDoctor[id] || 0,
                    months,
                };
            })
            .sort((a, b) => a.name.localeCompare(b.name));

        res.json({
            generatedAt: now.toISOString(),
            method: "Ye seedhe trend (linear) par based andaza hai, pakka nateeja nahi.",
            mostCommonDiseaseThisMonth,
            topDiagnosesThisMonth,
            patientLoadForecast,
            doctorPerformance,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};