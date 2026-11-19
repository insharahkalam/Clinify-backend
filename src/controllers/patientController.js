import User from "../models/User.js";
import Patient from "../models/Patient.js";
import Prescription from "../models/Prescription.js";
import buildTimeline from "../utils/buildTimeline.js";

// Apni profile dekhna
export const getMyProfile = async (req, res) => {
    try {
        const patient = await Patient.findOne({ user: req.user._id });
        res.json({ user: req.user, patient });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Apni profile update karna
export const updateMyProfile = async (req, res) => {
    try {
        const { name, phone, age, gender, address, bloodGroup } = req.body;

        await User.findByIdAndUpdate(req.user._id, { name, phone });

        const patient = await Patient.findOneAndUpdate(
            { user: req.user._id },
            { age, gender, address, bloodGroup },
            { returnDocument: "after" }
        );

        res.json({ message: "Profile update ho gayi", patient });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Patient apni prescriptions dekhe
export const getMyPrescriptions = async (req, res) => {
    try {
        const patient = await Patient.findOne({ user: req.user._id });

        const prescriptions = await Prescription.find({ patient: patient._id })
            .populate("doctor", "name specialization")
            .sort({ createdAt: -1 });

        res.json(prescriptions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Patient apni medical history timeline dekhe
export const getMyTimeline = async (req, res) => {
    try {
        const patient = await Patient.findOne({ user: req.user._id });
        const timeline = await buildTimeline(patient._id);
        res.json(timeline);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};