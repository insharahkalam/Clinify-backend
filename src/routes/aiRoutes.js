import express from "express";
import { body, param } from "express-validator";
import validate from "../middleware/validate.js";
import { protect, allowRoles } from "../middleware/authMiddleware.js";
import { requireFeature } from "../middleware/planMiddleware.js";
import trackUsage from "../middleware/trackUsage.js";
import { aiStatus, symptomChecker, explainPrescription } from "../controllers/aiController.js";

const router = express.Router();

router.use(protect); // sab routes ke liye login zaroori

router.get("/status", allowRoles("admin", "doctor"), requireFeature("ai"), aiStatus);

router.post(
    "/symptom-check",
    allowRoles("doctor"),
    requireFeature("ai"),
    [
        body("symptoms")
            .trim()
            .notEmpty()
            .withMessage("Symptoms likhna zaroori hai")
            .isLength({ max: 1000 })
            .withMessage("Symptoms 1000 characters se kam likhein"),
        body("age").optional().isInt({ min: 0, max: 120 }).withMessage("Age 0 se 120 ke beech honi chahiye"),
        body("gender")
            .optional()
            .isIn(["male", "female", "other"])
            .withMessage("Gender sirf male, female ya other ho sakta hai"),
        body("history").optional().isLength({ max: 1000 }).withMessage("History 1000 characters se kam likhein"),
    ],
    validate,
    trackUsage("symptom_check"),
    symptomChecker
);

router.post(
    "/prescriptions/:id/explain",
    allowRoles("patient", "doctor"),
    requireFeature("ai"),
    [
        param("id").isMongoId().withMessage("Sahi id bhejein"),
        body("language")
            .optional()
            .isIn(["english", "roman-urdu", "urdu"])
            .withMessage("Language sirf english, roman-urdu ya urdu ho sakti hai"),
    ],
    validate,
    trackUsage("prescription_explain"),
    explainPrescription
);

export default router;