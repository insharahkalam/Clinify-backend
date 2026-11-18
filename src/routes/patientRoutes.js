import express from "express";
import { protect, allowRoles } from "../middleware/authMiddleware.js";
import {
    getMyProfile,
    updateMyProfile,
    getMyPrescriptions,
    getMyTimeline,
} from "../controllers/patientController.js";

const router = express.Router();

// Is file ke saare routes sirf patient ke liye hain
router.use(protect, allowRoles("patient"));

router.get("/profile", getMyProfile);
router.put("/profile", updateMyProfile);
router.get("/prescriptions", getMyPrescriptions);
router.get("/timeline", getMyTimeline);

export default router;