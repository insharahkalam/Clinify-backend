import bcrypt from "bcryptjs";
import User from "../models/User.js";

// Har logged-in user apna password badal sakta hai
export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // req.user mein password nahi hota (select("-password")), isliye dobara layein
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: "User nahi mila" });
        }

        // 400 dete hain, 401 nahi, warna frontend khud logout kar deta hai
        const ok = await bcrypt.compare(currentPassword, user.password);
        if (!ok) {
            return res.status(400).json({ message: "Maujooda password galat hai" });
        }

        if (currentPassword === newPassword) {
            return res.status(400).json({ message: "Naya password purane se alag hona chahiye" });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.json({ message: "Password badal gaya" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};