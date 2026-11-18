import dns from "dns"
dns.setServers(["8.8.8.8", "1.1.1.1"])

import dotenv from "dotenv";
dotenv.config()
import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";
import createAdmin from "./utils/createAdmin.js";
import authRoutes from "./routes/authRoutes.js";
import patientRoutes from "./routes/patientRoutes.js";
import receptionistRoutes from "./routes/receptionistRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import doctorRoutes from "./routes/doctorRoutes.js";
import prescriptionRoutes from "./routes/prescriptionRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";


await connectDB();
await createAdmin();

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.get("/", (req, res) => res.send("API chal rahi hai"));

app.use("/api/auth", authRoutes);
app.use("/api/patient", patientRoutes);
app.use("/api/receptionist", receptionistRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/doctor", doctorRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/reports", reportRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server port ${PORT} par chal raha hai`));