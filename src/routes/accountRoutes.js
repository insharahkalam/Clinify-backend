import express from "express";
import { body } from "express-validator";
import validate from "../middleware/validate.js";
import { protect } from "../middleware/authMiddleware.js";
import { passwordLimiter } from "../middleware/rateLimiter.js";
import { changePassword } from "../controllers/accountController.js";

const router = express.Router();

router.put(
    "/password",
    protect,
    passwordLimiter,
    [
        body("currentPassword").notEmpty().withMessage("Maujooda password likhein"),
        body("newPassword").isLength({ min: 8 }).withMessage("Naya password kam az kam 8 characters ka ho"),
    ],
    validate,
    changePassword
);

export default router;