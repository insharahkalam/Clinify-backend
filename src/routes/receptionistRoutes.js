import express from "express";
import { body } from "express-validator";
import validate from "../middleware/validate.js";
import { protect, allowRoles } from "../middleware/authMiddleware.js";
import {
    registerPatient,
    getAllPatients,
    getPatientById,
    updatePatient,
} from "../controllers/receptionistController.js";
import { checkPatientLimit } from "../middleware/planMiddleware.js";

const router = express.Router();

// Is file ke saare routes sirf receptionist ke liye hain
router.use(protect, allowRoles("receptionist"));

router.post(
    "/patients",
    [
        body("name").notEmpty().withMessage("Naam zaroori hai"),
        body("email").isEmail().withMessage("Sahi email likhein"),
        body("password").isLength({ min: 6 }).withMessage("Password kam az kam 6 characters ka ho"),
    ],
    validate,
    checkPatientLimit,
    registerPatient
);

router.get("/patients", getAllPatients);
router.get("/patients/:id", getPatientById);
router.put("/patients/:id", updatePatient);

export default router;