import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Patient from "../models/Patient.js";

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// Patient khud register karega
export const register = async (req, res) => {
    try {
        const { name, email, password, phone, age, gender, address, bloodGroup } = req.body;

        const exists = await User.findOne({ email });
        if (exists) {
            return res.status(400).json({ message: "Ye email pehle se registered hai" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // role hamesha "patient" hoga, user apna role khud nahi chun sakta
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            phone,
            role: "patient",
        });

        await Patient.create({ user: user._id, age, gender, address, bloodGroup });

        res.status(201).json({
            token: generateToken(user._id),
            user: { id: user._id, name: user.name, email: user.email, role: user.role },
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Sab roles ke liye login
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: "Email ya password galat hai" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Email ya password galat hai" });
        }

        res.json({
            token: generateToken(user._id),
            user: { id: user._id, name: user.name, email: user.email, role: user.role },
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};