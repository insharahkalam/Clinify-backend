import express from "express";
import { body } from "express-validator";
import validate from "../middleware/validate.js";
import { protect, allowRoles } from "../middleware/authMiddleware.js";
import {
    getDoctors,
    bookAppointment,
    cancelAppointment,
    updateStatus,
    getSchedule,
    getMyAppointments,
    rescheduleAppointment, getPatientAppointments,
    getAvailability
} from "../controllers/appointmentController.js";

const router = express.Router();

router.use(protect); // sab routes ke liye login zaroori

router.get("/doctors", allowRoles("receptionist", "patient"), getDoctors);
router.get("/my", allowRoles("patient"), getMyAppointments);
router.get("/schedule", allowRoles("receptionist", "doctor", "admin"), getSchedule);

router.get("/patient/:id", allowRoles("receptionist", "doctor", "admin"), getPatientAppointments);

router.put(
    "/:id/reschedule",
    allowRoles("receptionist"),
    [
        body("date").matches(/^\d{4}-\d{2}-\d{2}$/).withMessage("Date is format mein likhein: 2026-11-20"),
        body("timeSlot").notEmpty().withMessage("Time slot zaroori hai"),
    ],
    validate,
    rescheduleAppointment
);

router.post(
    "/",
    allowRoles("receptionist", "patient"),
    [
        body("doctorId").notEmpty().withMessage("Doctor chunna zaroori hai"),
        body("date")
            .matches(/^\d{4}-\d{2}-\d{2}$/)
            .withMessage("Date is format mein likhein: 2026-11-20"),
        body("timeSlot").notEmpty().withMessage("Time slot zaroori hai"),
    ],
    validate,
    bookAppointment
);

router.put("/:id/cancel", allowRoles("receptionist", "patient"), cancelAppointment);
router.put("/:id/status", allowRoles("receptionist", "doctor"), updateStatus);
router.get("/availability", allowRoles("receptionist", "patient"), getAvailability);

export default router;