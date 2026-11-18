import Report from "../models/Report.js";
import Patient from "../models/Patient.js";
import Appointment from "../models/Appointment.js";
import cloudinary, { isCloudinaryConfigured } from "../utils/cloudinary.js";

const NOT_CONFIGURED = "Report upload abhi set nahi hai (Cloudinary ki keys .env mein daalein)";
const serverError = (res) => res.status(500).json({ message: "Server mein masla aa gaya" });

// Kya is doctor ki is mareez ke saath koi appointment hai?
const isMyPatient = async (doctorId, patientId) => {
    const found = await Appointment.findOne({ doctor: doctorId, patient: patientId });
    return !!found;
};

// Is user ko is mareez ki reports dekhne/dalne ki ijazat hai?
// patient: sirf apni, receptionist: sab, doctor: sirf apne mareez ki.
const canAccessPatient = async (user, patientId) => {
    if (user.role === "receptionist") return true;
    if (user.role === "doctor") return isMyPatient(user._id, patientId);
    if (user.role === "patient") {
        const me = await Patient.findOne({ user: user._id });
        return !!me && String(me._id) === String(patientId);
    }
    return false;
};

// Cloudinary par asal file ka type: PDF "raw" hoti hai, tasveer "image"
const resourceTypeOf = (ext) => (ext === "pdf" ? "raw" : "image");

// Cloudinary ke "authenticated" type ki file ka koi seedha link nahi hota, is liye
// download hamesha hamare backend se guzarta hai (jahan ijazat check hoti hai).
const uploadBuffer = (buffer, options) =>
    new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(options, (err, result) =>
            err ? reject(err) : resolve(result)
        );
        stream.end(buffer);
    });

// Frontend ko sirf wahi dikhao jo zaroori hai (publicId nahi)
const toPublic = (r) => ({
    _id: r._id,
    patient: r.patient,
    uploadedBy: r.uploadedBy,
    title: r.title,
    category: r.category,
    notes: r.notes,
    file: {
        originalName: r.file.originalName,
        format: r.file.format,
        mimeType: r.file.mimeType,
        bytes: r.file.bytes,
    },
    createdAt: r.createdAt,
});

// File ka naam saaf karo (folder wale ya ajeeb characters hata do)
const cleanName = (name = "file") =>
    String(name).replace(/[^\w.\- ]+/g, "_").slice(0, 100) || "file";

// POST /api/reports  (form-data: file, title, category?, notes?, patientId?)
export const uploadReport = async (req, res) => {
    try {
        if (!isCloudinaryConfigured()) return res.status(503).json({ message: NOT_CONFIGURED });

        // Kis mareez ki report hai
        let patientId;
        if (req.user.role === "patient") {
            const me = await Patient.findOne({ user: req.user._id });
            if (!me) return res.status(404).json({ message: "Patient profile nahi mila" });
            patientId = me._id;
        } else {
            if (!req.body.patientId) return res.status(400).json({ message: "patientId bhejein" });
            const p = await Patient.findById(req.body.patientId);
            if (!p) return res.status(404).json({ message: "Patient nahi mila" });
            if (!(await canAccessPatient(req.user, p._id))) {
                return res.status(403).json({ message: "Ye aap ka mareez nahi hai" });
            }
            patientId = p._id;
        }

        const { ext, mimeType } = req.fileType;
        const resourceType = resourceTypeOf(ext);
        const random = Math.random().toString(36).slice(2, 10);
        // PDF (raw) ke public_id mein extension khud likhni parti hai
        const publicId = `${Date.now()}-${random}` + (resourceType === "raw" ? `.${ext}` : "");

        let uploaded;
        try {
            uploaded = await uploadBuffer(req.file.buffer, {
                folder: `clinicai/reports/${patientId}`,
                public_id: publicId,
                resource_type: resourceType,
                type: "authenticated", // private: bina signed link ke koi nahi khol sakta
            });
        } catch (err) {
            console.error("Cloudinary upload error:", err.message);
            return res.status(502).json({ message: "File Cloudinary par upload nahi ho saki, dobara koshish karein" });
        }

        try {
            const report = await Report.create({
                patient: patientId,
                uploadedBy: req.user._id,
                title: req.body.title,
                category: req.body.category || "other",
                notes: req.body.notes || "",
                file: {
                    publicId: uploaded.public_id,
                    resourceType,
                    format: ext,
                    bytes: uploaded.bytes || req.file.size,
                    originalName: cleanName(req.file.originalname),
                    mimeType,
                },
            });
            res.status(201).json({ message: "Report upload ho gayi", report: toPublic(report) });
        } catch (err) {
            // DB mein save na ho saki to Cloudinary par bhi na rahe (warna bekar file pari rehti)
            await cloudinary.uploader
                .destroy(uploaded.public_id, { resource_type: resourceType, type: "authenticated" })
                .catch(() => { });
            throw err;
        }
    } catch (err) {
        console.error(err);
        serverError(res);
    }
};

// GET /api/reports?patientId=...   (patient ke liye patientId zaroori nahi)
export const listReports = async (req, res) => {
    try {
        let patientId;
        if (req.user.role === "patient") {
            const me = await Patient.findOne({ user: req.user._id });
            if (!me) return res.status(404).json({ message: "Patient profile nahi mila" });
            patientId = me._id;
        } else {
            if (!req.query.patientId) return res.status(400).json({ message: "patientId bhejein" });
            if (!(await canAccessPatient(req.user, req.query.patientId))) {
                return res.status(403).json({ message: "Ye aap ka mareez nahi hai" });
            }
            patientId = req.query.patientId;
        }

        const reports = await Report.find({ patient: patientId })
            .populate("uploadedBy", "name role")
            .sort({ createdAt: -1 });
        res.json(reports.map(toPublic));
    } catch (err) {
        console.error(err);
        serverError(res);
    }
};

// GET /api/reports/:id/file  -> asal file (image ya PDF) wapas deta hai
export const getReportFile = async (req, res) => {
    try {
        if (!isCloudinaryConfigured()) return res.status(503).json({ message: NOT_CONFIGURED });

        const report = await Report.findById(req.params.id);
        if (!report) return res.status(404).json({ message: "Report nahi mili" });
        if (!(await canAccessPatient(req.user, report.patient))) {
            return res.status(403).json({ message: "Aapko is report ki ijazat nahi hai" });
        }

        const f = report.file;
        // 5 minute ka signed link, sirf hamare server ke liye
        const url = cloudinary.utils.private_download_url(f.publicId, f.resourceType === "raw" ? "" : f.format, {
            resource_type: f.resourceType,
            type: "authenticated",
            expires_at: Math.floor(Date.now() / 1000) + 300,
        });

        let cloudRes;
        try {
            cloudRes = await fetch(url);
        } catch (err) {
            cloudRes = null;
        }
        if (!cloudRes || !cloudRes.ok) {
            return res.status(502).json({ message: "File Cloudinary se nahi mil saki, thori der baad koshish karein" });
        }

        const buffer = Buffer.from(await cloudRes.arrayBuffer());
        res.set({
            "Content-Type": f.mimeType, // hamara pehchana hua type, user ka bheja hua nahi
            "Content-Length": buffer.length,
            "Content-Disposition": `inline; filename="${cleanName(f.originalName)}"`,
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
        });
        res.send(buffer);
    } catch (err) {
        console.error(err);
        serverError(res);
    }
};

// DELETE /api/reports/:id  -> upload karne wala, ya receptionist
export const deleteReport = async (req, res) => {
    try {
        if (!isCloudinaryConfigured()) return res.status(503).json({ message: NOT_CONFIGURED });

        const report = await Report.findById(req.params.id);
        if (!report) return res.status(404).json({ message: "Report nahi mili" });

        const isUploader = String(report.uploadedBy) === String(req.user._id);
        if (!isUploader && req.user.role !== "receptionist") {
            return res.status(403).json({ message: "Ye report aap hata nahi sakte" });
        }

        // Pehle Cloudinary se hatao. Fail ho to DB record rakho taake dobara try ho sake.
        try {
            const result = await cloudinary.uploader.destroy(report.file.publicId, {
                resource_type: report.file.resourceType,
                type: "authenticated",
                invalidate: true,
            });
            if (result.result !== "ok" && result.result !== "not found") {
                throw new Error("destroy result: " + result.result);
            }
        } catch (err) {
            console.error("Cloudinary delete error:", err.message);
            return res.status(502).json({ message: "File Cloudinary se hat nahi saki, dobara koshish karein" });
        }

        await report.deleteOne();
        res.json({ message: "Report hata di gayi" });
    } catch (err) {
        console.error(err);
        serverError(res);
    }
};

// GET /api/reports/status  -> Cloudinary chal raha hai ya nahi
export const getStatus = async (req, res) => {
    if (!isCloudinaryConfigured()) {
        return res.json({ configured: false, connected: false, message: NOT_CONFIGURED });
    }
    try {
        await cloudinary.api.ping();
        res.json({ configured: true, connected: true, maxMb: Number(process.env.REPORT_MAX_MB) || 5 });
    } catch (err) {
        res.json({ configured: true, connected: false, message: "Cloudinary se rabta nahi hua (keys check karein)" });
    }
};