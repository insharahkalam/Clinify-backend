import Appointment from "../models/Appointment.js";
import Diagnosis from "../models/Diagnosis.js";
import Prescription from "../models/Prescription.js";

const buildTimeline = async (patientId) => {
    const appointments = await Appointment.find({ patient: patientId }).populate("doctor", "name");
    const diagnoses = await Diagnosis.find({ patient: patientId }).populate("doctor", "name");
    const prescriptions = await Prescription.find({ patient: patientId }).populate("doctor", "name");

    const timeline = [
        ...appointments.map((a) => ({ type: "appointment", date: a.createdAt, data: a })),
        ...diagnoses.map((d) => ({ type: "diagnosis", date: d.createdAt, data: d })),
        ...prescriptions.map((p) => ({ type: "prescription", date: p.createdAt, data: p })),
    ];

    // Naya pehle
    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    return timeline;
};

export default buildTimeline;