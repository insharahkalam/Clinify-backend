import PDFDocument from "pdfkit";

// ClinicAI ki lavender theme
const C = {
    primary: "#A99BCB",
    dark: "#8F7FB8",
    secondary: "#D9D0EC",
    bg: "#F7F5FC",
    ink: "#454052",
    muted: "#8A8598",
    line: "#EAE5F3",
    white: "#FFFFFF",
};

const M = 50; // left/right margin
const PAGE_W = 595.28; // A4
const W = PAGE_W - M * 2; // content width
const FOOTER_SPACE = 90; // neeche footer ke liye jagah

const COLS = [
    { label: "#", w: 28 },
    { label: "MEDICINE", w: 175 },
    { label: "DOSAGE", w: 90 },
    { label: "FREQUENCY", w: 110 },
    { label: "DURATION", w: 92 },
];

const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : "");

const generatePrescriptionPdf = (prescription, stream) => {
    const doc = new PDFDocument({
        size: "A4",
        margins: { top: 0, bottom: 0, left: M, right: M }, // jagah hum khud sambhalte hain
        bufferPages: true, // taake har page par footer lag sake
        info: { Title: "Prescription", Author: "ClinicAI" },
    });
    doc.pipe(stream);

    const patient = prescription.patient || {};
    const patientUser = patient.user || {};
    const doctor = prescription.doctor || {};
    const date = new Date(prescription.createdAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
    const ref = `RX-${String(prescription._id).slice(-8).toUpperCase()}`;
    const pageLimit = () => doc.page.height - FOOTER_SPACE;

    // ---------- Header ----------
    doc.rect(0, 0, PAGE_W, 105).fill(C.primary);

    doc.circle(M + 20, 52, 20).fill(C.white);
    doc.rect(M + 18, 42, 4, 20).fill(C.primary);
    doc.rect(M + 10, 50, 20, 4).fill(C.primary);

    doc.fillColor(C.white).font("Helvetica-Bold").fontSize(22).text("ClinicAI", M + 52, 34, { lineBreak: false });
    doc.font("Helvetica").fontSize(9.5).text("Clinic Management & Smart Diagnosis", M + 52, 62, { lineBreak: false });

    doc.font("Helvetica-Bold").fontSize(15).text("PRESCRIPTION", M, 34, { width: W, align: "right", lineBreak: false });
    doc.font("Helvetica").fontSize(9.5);
    doc.text(`Ref: ${ref}`, M, 58, { width: W, align: "right", lineBreak: false });
    doc.text(`Date: ${date}`, M, 73, { width: W, align: "right", lineBreak: false });

    // ---------- Doctor aur Patient ke cards ----------
    const cardY = 128;
    const cardH = 96;
    const gap = 16;
    const cardW = (W - gap) / 2;

    const drawCard = (x, label, title, lines) => {
        doc.lineWidth(1).roundedRect(x, cardY, cardW, cardH, 10).fillAndStroke(C.bg, C.line);
        doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(8.5).text(label, x + 16, cardY + 14, { lineBreak: false });
        doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(13).text(title, x + 16, cardY + 30, {
            width: cardW - 32,
            lineBreak: false,
            ellipsis: true,
        });
        doc.font("Helvetica").fontSize(9.5).fillColor(C.muted);
        lines.forEach((line, i) => {
            doc.text(line, x + 16, cardY + 52 + i * 15, { width: cardW - 32, lineBreak: false, ellipsis: true });
        });
    };

    drawCard(M, "DOCTOR", `Dr. ${doctor.name || "-"}`, [doctor.specialization || "General Practitioner"]);

    const patientInfo = [
        patient.age ? `Age: ${patient.age}` : null,
        patient.gender ? `Gender: ${cap(patient.gender)}` : null,
        patient.bloodGroup ? `Blood: ${patient.bloodGroup}` : null,
    ].filter(Boolean);

    drawCard(M + cardW + gap, "PATIENT", patientUser.name || "-", [
        patientInfo.join("   |   ") || "-",
        patientUser.phone ? `Phone: ${patientUser.phone}` : "",
    ].filter(Boolean));

    // ---------- Medicines ----------
    let y = cardY + cardH + 28;

    doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(24).text("Rx", M, y, { lineBreak: false });
    doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(13).text("Medicines", M + 38, y + 8, { lineBreak: false });
    y += 38;

    const drawTableHeader = (top) => {
        doc.rect(M, top, W, 26).fill(C.secondary);
        let x = M;
        doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(8.5);
        COLS.forEach((col) => {
            doc.text(col.label, x + 8, top + 9, { width: col.w - 16, lineBreak: false });
            x += col.w;
        });
        return top + 26;
    };

    y = drawTableHeader(y);

    (prescription.medicines || []).forEach((m, i) => {
        const cells = [String(i + 1), m.name || "-", m.dosage || "-", m.frequency || "-", m.duration || "-"];

        const heights = cells.map((text, c) => {
            doc.font(c === 1 ? "Helvetica-Bold" : "Helvetica").fontSize(10.5);
            return doc.heightOfString(text, { width: COLS[c].w - 16 });
        });
        const h = Math.max(32, Math.max(...heights) + 18);

        // Jagah kam ho to naya page, aur table ka header dobara
        if (y + h > pageLimit()) {
            doc.addPage();
            y = drawTableHeader(M);
        }

        if (i % 2 === 1) doc.rect(M, y, W, h).fill(C.bg);
        doc.lineWidth(0.5).strokeColor(C.line).moveTo(M, y + h).lineTo(M + W, y + h).stroke();

        let x = M;
        cells.forEach((text, c) => {
            doc
                .fillColor(c === 0 ? C.muted : C.ink)
                .font(c === 1 ? "Helvetica-Bold" : "Helvetica")
                .fontSize(10.5)
                .text(text, x + 8, y + 9, { width: COLS[c].w - 16 });
            x += COLS[c].w;
        });
        y += h;
    });

    // ---------- Notes ----------
    if (prescription.notes) {
        doc.font("Helvetica").fontSize(10.5);
        const textH = doc.heightOfString(prescription.notes, { width: W - 32 });
        const boxH = textH + 46;

        y += 24;
        if (y + boxH > pageLimit()) {
            doc.addPage();
            y = M;
        }

        doc.lineWidth(1).roundedRect(M, y, W, boxH, 10).fillAndStroke(C.bg, C.line);
        doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(8.5).text("DOCTOR'S NOTES", M + 16, y + 14, { lineBreak: false });
        doc.fillColor(C.ink).font("Helvetica").fontSize(10.5).text(prescription.notes, M + 16, y + 30, { width: W - 32 });
        y += boxH;
    }

    // ---------- Signature ----------
    y += 50;
    if (y + 50 > pageLimit()) {
        doc.addPage();
        y = M + 20;
    }
    const sigW = 190;
    const sigX = M + W - sigW;
    doc.lineWidth(0.8).strokeColor(C.muted).moveTo(sigX, y).lineTo(sigX + sigW, y).stroke();
    doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(10).text(`Dr. ${doctor.name || ""}`, sigX, y + 8, {
        width: sigW,
        align: "center",
        lineBreak: false,
    });
    doc.fillColor(C.muted).font("Helvetica").fontSize(8.5).text("Doctor's signature", sigX, y + 23, {
        width: sigW,
        align: "center",
        lineBreak: false,
    });

    // ---------- Har page par footer ----------
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        const fy = doc.page.height - 62;

        doc.lineWidth(0.8).strokeColor(C.line).moveTo(M, fy).lineTo(M + W, fy).stroke();
        doc.fillColor(C.muted).font("Helvetica").fontSize(8.5);
        doc.text(
            "This is a computer-generated prescription. Take medicines exactly as advised by your doctor.",
            M, fy + 10, { width: W, align: "center", lineBreak: false }
        );
        doc.text("ClinicAI", M, fy + 26, { width: W / 2, align: "left", lineBreak: false });
        doc.text(`Page ${i + 1} of ${range.count}`, M + W / 2, fy + 26, { width: W / 2, align: "right", lineBreak: false });
    }

    doc.end();
};

export default generatePrescriptionPdf;