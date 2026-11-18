import multer from "multer";

const maxMb = Number(process.env.REPORT_MAX_MB) || 5;

// File RAM mein aati hai (disk par kuch save nahi hota), phir seedha Cloudinary ko jati hai
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxMb * 1024 * 1024, files: 1 },
}).single("file");

// File ke pehle bytes dekh kar asli type pehchanta hai.
// (User file ka naam ya type jhoota bhej sakta hai, bytes jhoote nahi hote.)
const detectType = (buf) => {
    if (buf.length < 12) return null;
    if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return { mimeType: "application/pdf", ext: "pdf" };
    if (buf[0] === 0x89 && buf.subarray(1, 4).toString("latin1") === "PNG") return { mimeType: "image/png", ext: "png" };
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mimeType: "image/jpeg", ext: "jpg" };
    if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP")
        return { mimeType: "image/webp", ext: "webp" };
    return null;
};

// Route mein: uploadFile pehle, phir validators (kyunke multipart ke text fields isi ke baad milte hain)
export const uploadFile = (req, res, next) => {
    upload(req, res, (err) => {
        if (err) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({ message: `File ${maxMb} MB se choti honi chahiye` });
            }
            if (err instanceof multer.MulterError) {
                return res.status(400).json({ message: "File sahi tarah nahi bheji. Sirf ek file, field ka naam 'file'" });
            }
            return res.status(400).json({ message: "File parhi nahi ja saki" });
        }
        if (!req.file) {
            return res.status(400).json({ message: "File chunein (form-data mein field ka naam: file)" });
        }
        const type = detectType(req.file.buffer);
        if (!type) {
            return res.status(400).json({ message: "Sirf JPG, PNG, WebP ya PDF file chalegi" });
        }
        req.fileType = type;
        next();
    });
};