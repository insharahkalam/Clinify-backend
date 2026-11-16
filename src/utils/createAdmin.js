import bcrypt from "bcryptjs";
import User from "../models/User.js";

const createAdmin = async () => {
    try {
        const exists = await User.findOne({ role: "admin" });
        if (exists) return; // admin pehle se hai, kuch nahi karna

        const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);

        await User.create({
            name: process.env.ADMIN_NAME,
            email: process.env.ADMIN_EMAIL,
            password: hashedPassword,
            role: "admin",
        });

        console.log("Pehla admin ban gaya:", process.env.ADMIN_EMAIL);
    } catch (error) {
        console.log("Admin banane mein error:", error.message);
    }
};

export default createAdmin;
