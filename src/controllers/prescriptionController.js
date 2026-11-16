import Prescription from "../models/Prescription.js";
import Patient from "../models/Patient.js";
import generatePrescriptionPdf from "../utils/generatePrescriptionPdf.js";

export const downloadPrescriptionPdf = async (req, res) => {
    try {
        const prescription = await Prescription.findById(req.params.id)
            .populate("doctor", "name specialization")
            .populate({ path: "patient", populate: { path: "user", select: "name phone" } });

        if (!prescription) {
            return res.status(404).json({ message: "Prescription nahi mili" });
        }

        // Patient sirf apni prescription dekh sakta hai
        if (req.user.role === "patient") {
            const me = await Patient.findOne({ user: req.user._id });
            if (prescription.patient._id.toString() !== me._id.toString()) {
                return res.status(403).json({ message: "Ye aapki prescription nahi hai" });
            }
        }

        // Doctor sirf apni likhi hui prescription dekh sakta hai
        if (req.user.role === "doctor" && prescription.doctor._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Ye aapki likhi hui prescription nahi hai" });
        }

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=prescription-${prescription._id}.pdf`
        );

        generatePrescriptionPdf(prescription, res);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};