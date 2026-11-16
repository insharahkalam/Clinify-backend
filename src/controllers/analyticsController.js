import User from "../models/User.js";
import Appointment from "../models/Appointment.js";
import Diagnosis from "../models/Diagnosis.js";
import Prescription from "../models/Prescription.js";

// Simulated revenue: har completed appointment ki fees (PKR)
const CONSULTATION_FEE = 1000;

// Date ko "2026-11-15" format mein badalna
const toDateString = (date) => date.toLocaleDateString("en-CA");

// ================= ADMIN DASHBOARD =================
export const getAdminAnalytics = async (req, res) => {
    try {
        const month = toDateString(new Date()).slice(0, 7); // "2026-11"
        const monthFilter = { date: { $regex: `^${month}` } };

        // Total counts
        const totalPatients = await User.countDocuments({ role: "patient" });
        const totalDoctors = await User.countDocuments({ role: "doctor" });
        const totalReceptionists = await User.countDocuments({ role: "receptionist" });

        // Appointments
        const totalAppointments = await Appointment.countDocuments();
        const thisMonthAppointments = await Appointment.countDocuments({
            ...monthFilter,
            status: { $ne: "cancelled" },
        });

        // Status ke hisaab se count
        const statusData = await Appointment.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } },
        ]);
        const appointmentsByStatus = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
        statusData.forEach((s) => {
            appointmentsByStatus[s._id] = s.count;
        });

        // Revenue (simulated): completed appointments x fees
        const completedThisMonth = await Appointment.countDocuments({
            ...monthFilter,
            status: "completed",
        });
        const completedTotal = appointmentsByStatus.completed;

        // Sab se common 5 diagnosis
        const diagnosisData = await Diagnosis.aggregate([
            { $group: { _id: { $toLower: { $trim: { input: "$diagnosis" } } }, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
        ]);
        const mostCommonDiagnosis = diagnosisData.map((d) => ({ name: d._id, count: d.count }));

        // Pichle 6 mahine ki appointments (chart ke liye)
        const monthlyData = await Appointment.aggregate([
            { $match: { status: { $ne: "cancelled" } } },
            { $group: { _id: { $substrCP: ["$date", 0, 7] }, count: { $sum: 1 } } },
            { $sort: { _id: -1 } },
            { $limit: 6 },
        ]);
        const monthlyAppointments = monthlyData
            .map((m) => ({ month: m._id, count: m.count }))
            .reverse();

        res.json({
            totalPatients,
            totalDoctors,
            totalReceptionists,
            totalAppointments,
            thisMonthAppointments,
            appointmentsByStatus,
            revenue: {
                feePerAppointment: CONSULTATION_FEE,
                thisMonth: completedThisMonth * CONSULTATION_FEE,
                total: completedTotal * CONSULTATION_FEE,
                simulated: true,
            },
            mostCommonDiagnosis,
            monthlyAppointments,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ================= DOCTOR DASHBOARD =================
export const getDoctorAnalytics = async (req, res) => {
    try {
        const doctorId = req.user._id;
        const now = new Date();
        const today = toDateString(now);
        const month = today.slice(0, 7);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Aaj ki appointments
        const todayAppointments = await Appointment.countDocuments({
            doctor: doctorId,
            date: today,
            status: { $ne: "cancelled" },
        });

        // Is mahine ki stats
        const monthFilter = { doctor: doctorId, date: { $regex: `^${month}` } };
        const monthTotal = await Appointment.countDocuments({
            ...monthFilter,
            status: { $ne: "cancelled" },
        });
        const monthCompleted = await Appointment.countDocuments({ ...monthFilter, status: "completed" });
        const monthCancelled = await Appointment.countDocuments({ ...monthFilter, status: "cancelled" });

        // Prescriptions
        const totalPrescriptions = await Prescription.countDocuments({ doctor: doctorId });
        const monthPrescriptions = await Prescription.countDocuments({
            doctor: doctorId,
            createdAt: { $gte: startOfMonth },
        });

        // Kitne alag patients ka ilaaj hua (completed appointments)
        const treated = await Appointment.distinct("patient", {
            doctor: doctorId,
            status: "completed",
        });

        // Pichle 7 din ki daily appointments (chart ke liye)
        const last7Dates = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            last7Dates.push(toDateString(d));
        }

        const dailyData = await Appointment.aggregate([
            { $match: { doctor: doctorId, date: { $in: last7Dates }, status: { $ne: "cancelled" } } },
            { $group: { _id: "$date", count: { $sum: 1 } } },
        ]);

        const last7Days = last7Dates.map((date) => {
            const found = dailyData.find((d) => d._id === date);
            return { date, count: found ? found.count : 0 };
        });

        res.json({
            todayAppointments,
            thisMonth: { total: monthTotal, completed: monthCompleted, cancelled: monthCancelled },
            prescriptions: { total: totalPrescriptions, thisMonth: monthPrescriptions },
            patientsTreated: treated.length,
            last7Days,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};