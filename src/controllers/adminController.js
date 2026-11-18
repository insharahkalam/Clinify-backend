import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Patient from "../models/Patient.js";

// Doctor ya receptionist banana
export const createStaff = async (req, res) => {
    try {
        const { name, email, password, phone, role, specialization } = req.body;

        const exists = await User.findOne({ email });
        if (exists) {
            return res.status(400).json({ message: "Ye email pehle se registered hai" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            phone,
            role, // validation mein check ho chuka hai: sirf doctor ya receptionist
            specialization: role === "doctor" ? specialization : undefined,
        });

        res.status(201).json({
            message: `${role} ban gaya`,
            user: { id: user._id, name: user.name, email: user.email, role: user.role },
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Staff ki list (?role=doctor ya ?role=receptionist)
export const getStaff = async (req, res) => {
    try {
        const filter = { role: { $in: ["doctor", "receptionist"] } };

        if (req.query.role === "doctor" || req.query.role === "receptionist") {
            filter.role = req.query.role;
        }

        const staff = await User.find(filter).select("-password").sort({ createdAt: -1 });
        res.json(staff);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Staff member update karna
export const updateStaff = async (req, res) => {
    try {
        const { name, phone, specialization } = req.body;

        const staff = await User.findOneAndUpdate(
            { _id: req.params.id, role: { $in: ["doctor", "receptionist"] } },
            { name, phone, specialization },
            { new: true }
        ).select("-password");

        if (!staff) {
            return res.status(404).json({ message: "Staff member nahi mila" });
        }

        res.json({ message: "Update ho gaya", staff });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Staff member delete karna
export const deleteStaff = async (req, res) => {
    try {
        const staff = await User.findOneAndDelete({
            _id: req.params.id,
            role: { $in: ["doctor", "receptionist"] },
        });

        if (!staff) {
            return res.status(404).json({ message: "Staff member nahi mila" });
        }

        res.json({ message: "Staff member delete ho gaya" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Admin: patients ki read-only list (medical notes nahi)
export const getPatients = async (req, res) => {
    try {
        const patients = await Patient.find()
            .select("-medicalNotes")
            .populate("user", "name email phone")
            .sort({ createdAt: -1 });
        res.json(patients);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};