import PDFDocument from "pdfkit";

const generatePrescriptionPdf = (prescription, stream) => {
    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(stream);

    const patientUser = prescription.patient.user;
    const date = new Date(prescription.createdAt).toLocaleDateString("en-GB");

    // Header
    doc.fontSize(24).text("ClinicAI", { align: "center" });
    doc.fontSize(12).text("Prescription", { align: "center" });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    // Doctor aur patient ki detail
    doc.fontSize(12);
    doc.text(`Date: ${date}`);
    doc.text(`Doctor: ${prescription.doctor.name}`);
    if (prescription.doctor.specialization) {
        doc.text(`Specialization: ${prescription.doctor.specialization}`);
    }
    doc.moveDown(0.5);
    doc.text(`Patient: ${patientUser.name}`);
    if (prescription.patient.age) doc.text(`Age: ${prescription.patient.age}`);
    if (prescription.patient.gender) doc.text(`Gender: ${prescription.patient.gender}`);
    doc.moveDown();

    // Medicines
    doc.fontSize(14).text("Medicines");
    doc.moveDown(0.5);
    prescription.medicines.forEach((m, i) => {
        doc.fontSize(12).text(`${i + 1}. ${m.name}`);
        doc.fontSize(11).text(`Dosage: ${m.dosage}`, { indent: 20 });
        if (m.duration) doc.text(`Duration: ${m.duration}`, { indent: 20 });
        doc.moveDown(0.5);
    });

    // Notes
    if (prescription.notes) {
        doc.moveDown();
        doc.fontSize(14).text("Notes");
        doc.fontSize(11).text(prescription.notes);
    }

    // Footer
    doc.moveDown(2);
    doc.fontSize(9).text("This is a computer-generated prescription.", { align: "center" });

    doc.end();
};

export default generatePrescriptionPdf;