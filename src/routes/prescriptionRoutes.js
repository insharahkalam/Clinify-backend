import express from "express";
import { param } from "express-validator";
import validate from "../middleware/validate.js";
import { protect, allowRoles } from "../middleware/authMiddleware.js";
import trackUsage from "../middleware/trackUsage.js";
import { downloadPrescriptionPdf } from "../controllers/prescriptionController.js";

const router = express.Router();

router.get(
    "/:id/pdf",
    protect,
    allowRoles("patient", "doctor"),
    [param("id").isMongoId().withMessage("Sahi id bhejein")],
    validate,
    trackUsage("pdf_download"),
    downloadPrescriptionPdf
);

export default router;