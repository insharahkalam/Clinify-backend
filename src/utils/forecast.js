// Mahine aur forecast ke chhote helpers

const pad = (n) => String(n).padStart(2, "0");

// Date se "2026-11" banana
export const monthKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

// Kisi mahine se aage ya peeche jana (hamesha mahine ki 1 tareekh)
export const addMonths = (date, delta) => new Date(date.getFullYear(), date.getMonth() + delta, 1);

// Shuru ke woh mahine hata do jab clinic mein koi data hi nahi tha
export const trimLeadingZeros = (values) => {
    const first = values.findIndex((v) => v > 0);
    return first === -1 ? [] : values.slice(first);
};

// Do mahino ka mawazna: up / down / stable
export const compareTrend = (previous, last) => {
    if (previous === 0 && last === 0) return "no-data";
    if (previous === 0) return "up";
    const change = (last - previous) / previous;
    if (change > 0.1) return "up";
    if (change < -0.1) return "down";
    return "stable";
};

// Seedhi line (linear trend) se agla number andaza karna
export const linearForecast = (values) => {
    const n = values.length;

    if (n === 0) {
        return { forecast: 0, trend: "no-data", slope: 0, confidence: "low", basedOnMonths: 0 };
    }
    if (n === 1) {
        return { forecast: values[0], trend: "stable", slope: 0, confidence: "low", basedOnMonths: 1 };
    }

    const meanX = (n - 1) / 2;
    const meanY = values.reduce((sum, v) => sum + v, 0) / n;

    let top = 0;
    let bottom = 0;
    values.forEach((y, x) => {
        top += (x - meanX) * (y - meanY);
        bottom += (x - meanX) ** 2;
    });

    const slope = top / bottom;
    const intercept = meanY - slope * meanX;
    const forecast = Math.max(0, Math.round(intercept + slope * n));

    const relative = slope / Math.max(meanY, 1);
    const trend = relative > 0.05 ? "up" : relative < -0.05 ? "down" : "stable";

    return {
        forecast,
        trend,
        slope: Math.round(slope * 100) / 100,
        confidence: n >= 4 ? "medium" : "low",
        basedOnMonths: n,
    };
};