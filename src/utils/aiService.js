// Gemini API ko call karne ka simple helper (koi extra package nahi chahiye)
// Model busy ho (503/429) to dobara koshish karta hai, phir backup model par jata hai.

export const DEFAULT_MODEL = "gemini-3.8-flash";
const TIMEOUT_MS = 20000; // ek koshish ke liye 20 second
const RETRY_DELAY_MS = 1500;
const ATTEMPTS_PER_MODEL = 2;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Pehle asli model, phir backup (.env mein GEMINI_FALLBACK_MODELS=a,b likh sakte hain)
const getModels = () => {
    const primary = process.env.GEMINI_MODEL || DEFAULT_MODEL;
    const backups = (process.env.GEMINI_FALLBACK_MODELS || "gemini-2.5-flash")
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);
    return [...new Set([primary, ...backups])];
};

// Ek model ko ek dafa call karna
const callOnce = async (model, apiKey, prompt) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
                signal: controller.signal,
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            const error = new Error(`Gemini error ${response.status} (${model}): ${errorText.slice(0, 200)}`);
            error.status = response.status;
            throw error;
        }

        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const text = parts.map((p) => p.text || "").join("");

        if (!text.trim()) {
            const error = new Error(`Gemini ne khali jawab diya (${model})`);
            error.status = 503; // dobara koshish karne layak
            throw error;
        }

        return text;
    } catch (error) {
        if (error.name === "AbortError") {
            const timeout = new Error(`Gemini ne time par jawab nahi diya (${model})`);
            timeout.status = 504;
            throw timeout;
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
};

// Kaun se errors par dobara koshish ya doosra model chalega
const isBusy = (status) => status === 429 || status === 503 || status === 504 || status >= 500;

const callGemini = async (prompt) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY .env mein nahi hai");
    }

    let lastError;

    for (const model of getModels()) {
        for (let attempt = 1; attempt <= ATTEMPTS_PER_MODEL; attempt++) {
            try {
                const text = await callOnce(model, apiKey, prompt);
                if (model !== getModels()[0]) console.log(`AI backup model par chala: ${model}`);
                return text;
            } catch (error) {
                lastError = error;

                // Key ya request ka masla hai, doosre model se bhi theek nahi hoga
                if (error.status === 400 || error.status === 401 || error.status === 403) throw error;

                // Model nahi mila, seedha agle model par
                if (error.status === 404) break;

                // Busy hai, thora ruk kar dobara
                if (isBusy(error.status) && attempt < ATTEMPTS_PER_MODEL) {
                    await sleep(RETRY_DELAY_MS);
                    continue;
                }

                break; // is model se kaam nahi bana, agla model
            }
        }
    }

    throw lastError || new Error("AI se jawab nahi mila");
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