import Appointment from "../models/Appointment.js";
import Diagnosis from "../models/Diagnosis.js";
import Prescription from "../models/Prescription.js";
import Report from "../models/Report.js";

const buildTimeline = async (patientId) => {
    const appointments = await Appointment.find({ patient: patientId }).populate("doctor", "name");
    const diagnoses = await Diagnosis.find({ patient: patientId }).populate("doctor", "name");
    const prescriptions = await Prescription.find({ patient: patientId }).populate("doctor", "name");
    const reports = await Report.find({ patient: patientId }).populate("uploadedBy", "name");

    const timeline = [
        ...appointments.map((a) => ({ type: "appointment", date: a.createdAt, data: a })),
        ...diagnoses.map((d) => ({ type: "diagnosis", date: d.createdAt, data: d })),
        ...prescriptions.map((p) => ({ type: "prescription", date: p.createdAt, data: p })),
        // Report ka publicId frontend ko nahi jata, sirf safe fields
        ...reports.map((r) => ({
            type: "report",
            date: r.createdAt,
            data: {
                _id: r._id,
                title: r.title,
                category: r.category,
                notes: r.notes,
                uploadedBy: r.uploadedBy,
                file: {
                    originalName: r.file.originalName,
                    format: r.file.format,
                    mimeType: r.file.mimeType,
                    bytes: r.file.bytes,
                },
            },
        })),
    ];

    // Naya pehle
    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    return timeline;
};

export default buildTimeline;