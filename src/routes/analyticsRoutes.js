import express from "express";
import { protect, allowRoles } from "../middleware/authMiddleware.js";
import { requireFeature } from "../middleware/planMiddleware.js";
import { getAdminAnalytics, getDoctorAnalytics } from "../controllers/analyticsController.js";
import { getPredictions } from "../controllers/predictionController.js";

const router = express.Router();

router.get("/admin", protect, allowRoles("admin"), getAdminAnalytics);
router.get("/doctor", protect, allowRoles("doctor"), getDoctorAnalytics);
router.get("/predictions", protect, allowRoles("admin"), requireFeature("advancedAnalytics"), getPredictions);

export default router;