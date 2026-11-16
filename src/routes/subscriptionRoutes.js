import express from "express";
import { body } from "express-validator";
import validate from "../middleware/validate.js";
import { protect, allowRoles } from "../middleware/authMiddleware.js";
import {
    getFeatures,
    getSubscription,
    changePlan,
    getUsage,
} from "../controllers/subscriptionController.js";

const router = express.Router();

router.use(protect); // sab routes ke liye login zaroori

// Har role dekh sakta hai ke kaunse features khule hain
router.get("/features", getFeatures);

// Baqi sab sirf admin ke liye
router.get("/usage", allowRoles("admin"), getUsage);
router.get("/", allowRoles("admin"), getSubscription);

router.put(
    "/",
    allowRoles("admin"),
    [
        body("plan").isIn(["free", "pro"]).withMessage("Plan sirf free ya pro ho sakta hai"),
        body("months").optional().isInt({ min: 1, max: 12 }).withMessage("Months 1 se 12 ke beech hone chahiye"),
    ],
    validate,
    changePlan
);

export default router;