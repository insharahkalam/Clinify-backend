// Gemini API ko call karne ka simple helper (koi extra package nahi chahiye)

export const DEFAULT_MODEL = "gemini-3.8-flash";
const TIMEOUT_MS = 30000; // 30 second se zyada intezar nahi

const callGemini = async (prompt) => {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

    if (!apiKey) {
        throw new Error("GEMINI_API_KEY .env mein nahi hai");
    }

    // Zyada der lage to request cancel kar do
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": apiKey,
                },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
                signal: controller.signal,
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini error ${response.status}: ${errorText.slice(0, 200)}`);
        }

        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const text = parts.map((p) => p.text || "").join("");

        if (!text.trim()) {
            throw new Error("Gemini ne khali jawab diya");
        }

        return text;
    } catch (error) {
        if (error.name === "AbortError") {
            throw new Error("Gemini ne time par jawab nahi diya (timeout)");
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
};

// AI se JSON jawab lena
export const askGeminiJSON = async (prompt) => {
    const text = await callGemini(
        prompt + "\n\nIMPORTANT: Reply ONLY with valid JSON. No markdown, no code fences, no extra text."
    );

    // Kabhi kabhi AI ```json ... ``` laga deta hai, usay hata do
    const cleaned = text.replace(/```json|```/gi, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1 || end === -1) {
        throw new Error("AI ka jawab JSON nahi tha");
    }

    return JSON.parse(cleaned.slice(start, end + 1));
};