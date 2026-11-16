import UsageLog from "../models/UsageLog.js";

// Kamyab (200) request ke baad usage likh dena: trackUsage("symptom_check")
const trackUsage = (type) => (req, res, next) => {
    let source;

    // Jawab mein "source" (ai ya fallback) ho to usay yaad rakho
    const originalJson = res.json.bind(res);
    res.json = (body) => {
        source = body && body.source;
        return originalJson(body);
    };

    res.on("finish", () => {
        if (res.statusCode !== 200) return;
        // Log likhne mein masla aaye to bhi user ka kaam nahi rukna chahiye
        UsageLog.create({ type, user: req.user && req.user._id, source }).catch(() => { });
    });

    next();
};

export default trackUsage;