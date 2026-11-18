import express from "express";
import { body } from "express-validator";
import validate from "../middleware/validate.js";
import { protect, allowRoles } from "../middleware/authMiddleware.js";
import {
    createStaff,
    getStaff,
    updateStaff,
    deleteStaff,
    getPatients
} from "../controllers/adminController.js";

const router = express.Router();

// Is file ke saare routes sirf admin ke liye hain
router.use(protect, allowRoles("admin"));

router.post(
    "/staff",
    [
        body("name").notEmpty().withMessage("Naam zaroori hai"),
        body("email").isEmail().withMessage("Sahi email likhein"),
        body("password").isLength({ min: 6 }).withMessage("Password kam az kam 6 characters ka ho"),
        body("role")
            .isIn(["doctor", "receptionist"])
            .withMessage("Role sirf doctor ya receptionist ho sakta hai"),
    ],
    validate,
    createStaff
);

router.get("/staff", getStaff);
router.put("/staff/:id", updateStaff);
router.delete("/staff/:id", deleteStaff);
router.get("/patients", getPatients);

export default router;