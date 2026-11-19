import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Patient from "../models/Patient.js";

// Naya patient register karna
export const registerPatient = async (req, res) => {
    try {
        const { name, email, password, phone, age, gender, address, bloodGroup } = req.body;

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
            role: "patient",
        });

        const patient = await Patient.create({
            user: user._id,
            age,
            gender,
            address,
            bloodGroup,
        });

        res.status(201).json({ message: "Patient register ho gaya", patient });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Sab patients ki list (search bhi: ?search=ali)
export const getAllPatients = async (req, res) => {
    try {
        const search = req.query.search || "";

        const users = await User.find({
            role: "patient",
            name: { $regex: search, $options: "i" },
        }).select("_id");

        const userIds = users.map((u) => u._id);

        const patients = await Patient.find({ user: { $in: userIds } }).populate(
            "user",
            "name email phone"
        );

        res.json(patients);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Ek patient ki detail
export const getPatientById = async (req, res) => {
    try {
        const patient = await Patient.findById(req.params.id).populate(
            "user",
            "name email phone"
        );

        if (!patient) {
            return res.status(404).json({ message: "Patient nahi mila" });
        }

        res.json(patient);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Patient ki info update karna
export const updatePatient = async (req, res) => {
    try {
        const { name, phone, age, gender, address, bloodGroup, medicalNotes } = req.body;

        const patient = await Patient.findById(req.params.id);
        if (!patient) {
            return res.status(404).json({ message: "Patient nahi mila" });
        }

        await User.findByIdAndUpdate(patient.user, { name, phone });

        const updated = await Patient.findByIdAndUpdate(
            req.params.id,
            { age, gender, address, bloodGroup, medicalNotes },
            { returnDocument: "after" }
        ).populate("user", "name email phone");

        res.json({ message: "Patient update ho gaya", patient: updated });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};