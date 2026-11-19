import rateLimit from "express-rate-limit";

const limiter = (windowMs, limit, message, extra = {}) =>
    rateLimit({
        windowMs,
        limit,
        standardHeaders: true,
        legacyHeaders: false,
        message: { message },
        ...extra,
    });

// Sirf nakam koshishein ginti hain, sahi login par koi rukawat nahi
export const loginLimiter = limiter(
    15 * 60 * 1000, 10,
    "Bohat zyada galat koshishein hui hain, 15 minute baad dobara try karein",
    { skipSuccessfulRequests: true }
);

export const passwordLimiter = limiter(
    15 * 60 * 1000, 10,
    "Bohat zyada koshishein hui hain, 15 minute baad dobara try karein",
    { skipSuccessfulRequests: true }
);

export const registerLimiter = limiter(
    60 * 60 * 1000, 10,
    "Bohat zyada accounts banaye ja rahe hain, thori der baad dobara try karein"
);