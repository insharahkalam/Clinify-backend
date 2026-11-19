// Jo route maujood nahi
export const notFound = (req, res) => {
    res.status(404).json({ message: "Ye route maujood nahi hai" });
};

// Koi bhi ghair-mutawaqqa error: user ko saaf message, andar ki tafseel sirf terminal mein
export const errorHandler = (err, req, res, next) => {
    if (res.headersSent) return next(err);

    if (err.type === "entity.parse.failed") {
        return res.status(400).json({ message: "Bheja gaya JSON sahi nahi hai" });
    }
    if (err.type === "entity.too.large") {
        return res.status(413).json({ message: "Bheja gaya data bohat bara hai" });
    }

    console.error(err);
    const status = err.status && err.status < 500 ? err.status : 500;
    res.status(status).json({ message: status === 500 ? "Server mein masla aa gaya" : err.message });
};