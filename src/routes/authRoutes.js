import express from "express";
import { body } from "express-validator";
import validate from "../middleware/validate.js";
import { checkPatientLimit } from "../middleware/planMiddleware.js";
import { register, login } from "../controllers/authController.js";
import { loginLimiter, registerLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

router.post(
    "/register",
    registerLimiter,
    [
        body("name").notEmpty().withMessage("Naam zaroori hai"),
        body("email").isEmail().withMessage("Sahi email likhein"),
        body("password").isLength({ min: 6 }).withMessage("Password kam az kam 6 characters ka ho"),
    ],
    validate,
    checkPatientLimit,
    register
);

router.post(
    "/login",
    loginLimiter,
    [
    body("email").isEmail().withMessage("Sahi email likhein"),
    body("password").notEmpty().withMessage("Password likhein"),
    ],
    validate,
    login
);

export default router;