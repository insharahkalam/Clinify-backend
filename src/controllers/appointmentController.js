import Appointment from "../models/Appointment.js";
import Patient from "../models/Patient.js";
import User from "../models/User.js";

// Doctors ki list (booking ke waqt chunne ke liye)
export const getDoctors = async (req, res) => {
    try {
        const doctors = await User.find({ role: "doctor" }).select("name phone");
        res.json(doctors);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Appointment book karna (receptionist ya patient)
export const bookAppointment = async (req, res) => {
    try {
        const { patientId, doctorId, date, timeSlot, reason } = req.body;

        // Patient kaun hai? Agar patient khud book kar raha hai to wahi, warna receptionist ne bheja
        let patient;
        if (req.user.role === "patient") {
            patient = await Patient.findOne({ user: req.user._id });
        } else {
            patient = await Patient.findById(patientId);
        }

        if (!patient) {
            return res.status(404).json({ message: "Patient nahi mila" });
        }

        const doctor = await User.findOne({ _id: doctorId, role: "doctor" });
        if (!doctor) {
            return res.status(404).json({ message: "Doctor nahi mila" });
        }

        // Same doctor, same din, same time par dobara booking nahi hogi
        const alreadyBooked = await Appointment.findOne({
            doctor: doctorId,
            date,
            timeSlot,
            status: { $ne: "cancelled" },
        });

        if (alreadyBooked) {
            return res.status(400).json({ message: "Ye time slot pehle se booked hai" });
        }

        const appointment = await Appointment.create({
            patient: patient._id,
            doctor: doctorId,
            date,
            timeSlot,
            reason,
            bookedBy: req.user._id,
        });

        res.status(201).json({ message: "Appointment book ho gayi", appointment });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Appointment cancel karna
export const cancelAppointment = async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.id);
        if (!appointment) {
            return res.status(404).json({ message: "Appointment nahi mili" });
        }

        // Patient sirf apni appointment cancel kar sakta hai
        if (req.user.role === "patient") {
            const patient = await Patient.findOne({ user: req.user._id });
            if (appointment.patient.toString() !== patient._id.toString()) {
                return res.status(403).json({ message: "Ye aapki appointment nahi hai" });
            }
        }

        if (appointment.status === "completed") {
            return res.status(400).json({ message: "Completed appointment cancel nahi ho sakti" });
        }

        appointment.status = "cancelled";
        await appointment.save();

        res.json({ message: "Appointment cancel ho gayi", appointment });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Status update karna (pending / confirmed / completed)
export const updateStatus = async (req, res) => {
    try {
        const { status } = req.body;

        if (!["pending", "confirmed", "completed"].includes(status)) {
            return res.status(400).json({ message: "Status sirf pending, confirmed ya completed ho sakta hai" });
        }

        const appointment = await Appointment.findById(req.params.id);
        if (!appointment) {
            return res.status(404).json({ message: "Appointment nahi mili" });
        }

        if (appointment.status === "cancelled") {
            return res.status(400).json({ message: "Cancel hui appointment ka status nahi badal sakta" });
        }

        // Doctor sirf apni appointments ka status badal sakta hai
        if (req.user.role === "doctor" && appointment.doctor.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Ye aapki appointment nahi hai" });
        }

        appointment.status = status;
        await appointment.save();

        res.json({ message: "Status update ho gaya", appointment });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Kisi din ka schedule (?date=2026-11-20&doctorId=...)
export const getSchedule = async (req, res) => {
    try {
        // Date nahi di to aaj ki date
        const date = req.query.date || new Date().toLocaleDateString("en-CA");

        const filter = { date };

        if (req.user.role === "doctor") {
            filter.doctor = req.user._id; // doctor ko sirf apni appointments milengi
        } else if (req.query.doctorId) {
            filter.doctor = req.query.doctorId;
        }

        const appointments = await Appointment.find(filter)
            .populate({ path: "patient", populate: { path: "user", select: "name phone" } })
            .populate("doctor", "name")
            .sort({ timeSlot: 1 });

        res.json(appointments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Patient ki apni appointment history
export const getMyAppointments = async (req, res) => {
    try {
        const patient = await Patient.findOne({ user: req.user._id });

        const appointments = await Appointment.find({ patient: patient._id })
            .populate("doctor", "name")
            .sort({ date: -1 });

        res.json(appointments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Appointment ka din/time badalna
export const rescheduleAppointment = async (req, res) => {
    try {
        const { date, timeSlot } = req.body;

        const appointment = await Appointment.findById(req.params.id);
        if (!appointment) {
            return res.status(404).json({ message: "Appointment nahi mili" });
        }

        if (["completed", "cancelled"].includes(appointment.status)) {
            return res.status(400).json({ message: "Is appointment ko reschedule nahi kar sakte" });
        }

        const clash = await Appointment.findOne({
            _id: { $ne: appointment._id },
            doctor: appointment.doctor,
            date,
            timeSlot,
            status: { $ne: "cancelled" },
        });
        if (clash) {
            return res.status(400).json({ message: "Ye time slot pehle se booked hai" });
        }

        appointment.date = date;
        appointment.timeSlot = timeSlot;
        await appointment.save();

        res.json({ message: "Appointment reschedule ho gayi", appointment });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Kisi patient ki saari appointments
export const getPatientAppointments = async (req, res) => {
    try {
        const appointments = await Appointment.find({ patient: req.params.id })
            .populate("doctor", "name")
            .sort({ date: -1, timeSlot: -1 });

        res.json(appointments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Kisi doctor ke kisi din ke booked slots (sirf time, koi patient data nahi)
export const getAvailability = async (req, res) => {
    try {
        const { date, doctorId } = req.query;
        if (!date || !doctorId) {
            return res.status(400).json({ message: "date aur doctorId zaroori hain" });
        }

        const booked = await Appointment.find({
            doctor: doctorId,
            date,
            status: { $ne: "cancelled" },
        }).select("timeSlot");

        res.json(booked.map((a) => ({ _id: a._id, timeSlot: a.timeSlot })));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};