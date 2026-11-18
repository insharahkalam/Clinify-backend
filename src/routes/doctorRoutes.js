import express from "express";
import { body, param } from "express-validator";
import validate from "../middleware/validate.js";
import { protect, allowRoles } from "../middleware/authMiddleware.js";
import {
    getPatientHistory,
    addDiagnosis,
    createPrescription,
    getMyPrescriptions,
    getRiskFlags,
    getMyPatients
} from "../controllers/doctorController.js";

import { requireFeature } from "../middleware/planMiddleware.js";
import trackUsage from "../middleware/trackUsage.js";

const router = express.Router();

// Is file ke saare routes sirf doctor ke liye hain
router.use(protect, allowRoles("doctor"));

router.get("/patients/:id", getPatientHistory);

router.get(
    "/patients/:id/risk-flags",
    requireFeature("riskFlags"),
    [param("id").isMongoId().withMessage("Sahi id bhejein")],
    validate,
    trackUsage("risk_flags"),
    getRiskFlags
);

router.post(
    "/diagnosis",
    [
        body("patientId").isMongoId().withMessage("Sahi patientId bhejein"),
        body("appointmentId").optional().isMongoId().withMessage("Sahi appointmentId bhejein"),
        body("diagnosis").notEmpty().withMessage("Diagnosis likhna zaroori hai"),
    ],
    validate,
    addDiagnosis
);

router.post(
    "/prescriptions",
    [
        body("patientId").isMongoId().withMessage("Sahi patientId bhejein"),
        body("appointmentId").optional().isMongoId().withMessage("Sahi appointmentId bhejein"),
        body("medicines").isArray({ min: 1 }).withMessage("Kam az kam 1 medicine likhein"),
        body("medicines.*.name").notEmpty().withMessage("Medicine ka naam zaroori hai"),
        body("medicines.*.dosage").notEmpty().withMessage("Dosage likhna zaroori hai"),
    ],
    validate,
    createPrescription
);

router.get("/prescriptions", getMyPrescriptions);
router.get("/patients", getMyPatients);

export default router;