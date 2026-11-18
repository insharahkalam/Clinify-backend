import Appointment from "../models/Appointment.js";
import Patient from "../models/Patient.js";
import Diagnosis from "../models/Diagnosis.js";
import Prescription from "../models/Prescription.js";
import buildTimeline from "../utils/buildTimeline.js";
import analyzeRisk from "../utils/riskRules.js";

// Kya is doctor ki is patient ke saath koi appointment hai?
const isMyPatient = async (doctorId, patientId) => {
    const found = await Appointment.findOne({ doctor: doctorId, patient: patientId });
    return !!found;
};

// Patient ki profile + poori medical history timeline
export const getPatientHistory = async (req, res) => {
    try {
        const patient = await Patient.findById(req.params.id).populate("user", "name email phone");
        if (!patient) {
            return res.status(404).json({ message: "Patient nahi mila" });
        }

        if (!(await isMyPatient(req.user._id, patient._id))) {
            return res.status(403).json({ message: "Is patient ki aapke saath koi appointment nahi hai" });
        }

        const timeline = await buildTimeline(patient._id);
        res.json({ patient, timeline });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Diagnosis add karna
export const addDiagnosis = async (req, res) => {
    try {
        const { patientId, appointmentId, symptoms, diagnosis, notes } = req.body;

        if (!(await isMyPatient(req.user._id, patientId))) {
            return res.status(403).json({ message: "Is patient ki aapke saath koi appointment nahi hai" });
        }

        const saved = await Diagnosis.create({
            patient: patientId,
            doctor: req.user._id,
            appointment: appointmentId,
            symptoms,
            diagnosis,
            notes,
        });

        res.status(201).json({ message: "Diagnosis save ho gayi", diagnosis: saved });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Prescription likhna
export const createPrescription = async (req, res) => {
    try {
        const { patientId, appointmentId, medicines, notes } = req.body;

        if (!(await isMyPatient(req.user._id, patientId))) {
            return res.status(403).json({ message: "Is patient ki aapke saath koi appointment nahi hai" });
        }

        const prescription = await Prescription.create({
            patient: patientId,
            doctor: req.user._id,
            appointment: appointmentId,
            medicines,
            notes,
        });

        res.status(201).json({ message: "Prescription ban gayi", prescription });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Is doctor ki likhi hui saari prescriptions
export const getMyPrescriptions = async (req, res) => {
    try {
        const prescriptions = await Prescription.find({ doctor: req.user._id })
            .populate({ path: "patient", populate: { path: "user", select: "name" } })
            .sort({ createdAt: -1 });

        res.json(prescriptions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Patient ke risk flags (baar baar infection, chronic, khatarnak combinations)
export const getRiskFlags = async (req, res) => {
    try {
        const patient = await Patient.findById(req.params.id);
        if (!patient) {
            return res.status(404).json({ message: "Patient nahi mila" });
        }

        if (!(await isMyPatient(req.user._id, patient._id))) {
            return res.status(403).json({ message: "Is patient ki aapke saath koi appointment nahi hai" });
        }

        const diagnoses = await Diagnosis.find({ patient: patient._id }).sort({ createdAt: -1 }).limit(100);
        const result = analyzeRisk({ diagnoses, patient });

        res.json({
            patientId: patient._id,
            checkedDiagnoses: diagnoses.length,
            ...result,
            disclaimer: "Ye automatic rules par based hai, final faisla doctor ka hai.",
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Is doctor ke saare patients (jin ki iske saath appointment hai)
export const getMyPatients = async (req, res) => {
    try {
        const ids = await Appointment.distinct("patient", { doctor: req.user._id });
        const patients = await Patient.find({ _id: { $in: ids } }).populate("user", "name email phone");
        res.json(patients);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};