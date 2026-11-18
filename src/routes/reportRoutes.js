import express from "express";
import { body, param, query } from "express-validator";
import validate from "../middleware/validate.js";
import { protect, allowRoles } from "../middleware/authMiddleware.js";
import { uploadFile } from "../middleware/uploadMiddleware.js";
import {
    uploadReport,
    listReports,
    getReportFile,
    deleteReport,
    getStatus,
} from "../controllers/reportController.js";

const router = express.Router();

// Admin ko mareez ki reports ka access nahi (privacy)
const reportUsers = allowRoles("patient", "receptionist", "doctor");

router.get("/status", protect, allowRoles("admin", "receptionist"), getStatus);

router.post(
    "/",
    protect,
    reportUsers,
    uploadFile, // pehle file, phir neeche ke validators
    [
        body("title").trim().notEmpty().withMessage("Report ka title likhein").isLength({ max: 100 }).withMessage("Title 100 harf se chota rakhein"),
        body("category").optional().isIn(["lab_report", "xray", "scan", "other"]).withMessage("Category galat hai"),
        body("notes").optional().isLength({ max: 500 }).withMessage("Notes 500 harf se chote rakhein"),
        body("patientId").optional().isMongoId().withMessage("patientId sahi nahi hai"),
    ],
    validate,
    uploadReport
);

router.get(
    "/",
    protect,
    reportUsers,
    [query("patientId").optional().isMongoId().withMessage("patientId sahi nahi hai")],
    validate,
    listReports
);

router.get(
    "/:id/file",
    protect,
    reportUsers,
    [param("id").isMongoId().withMessage("Sahi id bhejein")],
    validate,
    getReportFile
);

router.delete(
    "/:id",
    protect,
    reportUsers,
    [param("id").isMongoId().withMessage("Sahi id bhejein")],
    validate,
    deleteReport
);

export default router;