import Prescription from "../models/Prescription.js";
import Diagnosis from "../models/Diagnosis.js";
import Patient from "../models/Patient.js";
import { askGeminiJSON, DEFAULT_MODEL } from "../utils/aiService.js";

// AI ki list ko saaf karna (sirf text, max 8 items)
const cleanList = (list) =>
    Array.isArray(list) ? list.map((x) => String(x).trim()).filter(Boolean).slice(0, 8) : [];

// ======================================================
//  AI STATUS (key aur model sahi hain ya nahi, check karne ke liye)
// ======================================================
export const aiStatus = async (req, res) => {
    const configured = Boolean(process.env.GEMINI_API_KEY);
    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

    if (!configured) {
        return res.json({ configured, model, working: false, error: "GEMINI_API_KEY .env mein nahi hai" });
    }

    try {
        await askGeminiJSON('Return exactly this JSON: {"ok": true}');
        res.json({ configured, model, working: true });
    } catch (error) {
        res.json({ configured, model, working: false, error: error.message });
    }
};

// ======================================================
//  1. SMART SYMPTOM CHECKER (sirf doctor)
// ======================================================

const SYMPTOM_DISCLAIMER =
    "Ye sirf decision support hai, final diagnosis nahi. Doctor apni clinical assessment khud karein.";

const buildSymptomPrompt = ({ symptoms, age, gender, history }) => `You are a clinical decision-support assistant helping a licensed doctor at a small clinic.

Patient details:
- Age: ${age ?? "not given"}
- Gender: ${gender || "not given"}
- Symptoms: ${symptoms}
- Medical history: ${history || "none given"}

Give a short list of possible conditions (most likely first, maximum 5), an overall risk level, and suggested tests.

Reply with JSON in exactly this shape:
{
  "possibleConditions": [{ "name": "string", "likelihood": "low | medium | high", "reason": "one short sentence" }],
  "riskLevel": "low | medium | high",
  "suggestedTests": ["string"],
  "advice": "one or two short sentences for the doctor"
}

Rules: This is only decision support, not a final diagnosis. Be cautious: if the symptoms could be an emergency (chest pain, breathing difficulty, stroke signs, severe bleeding), set riskLevel to high.`;

// AI ke jawab ko check karke saaf shakal dena
const normalizeSymptomResult = (raw) => {
    const conditions = Array.isArray(raw.possibleConditions) ? raw.possibleConditions : [];

    const possibleConditions = conditions
        .filter((c) => c && typeof c === "object")
        .slice(0, 5)
        .map((c) => ({
            name: String(c.name || "").trim(),
            likelihood: String(c.likelihood || "").toLowerCase(),
            reason: String(c.reason || "").trim(),
        }))
        .filter((c) => c.name);

    // Agar AI ne koi condition hi nahi di to usay fail maano (fallback chalega)
    if (possibleConditions.length === 0) {
        throw new Error("AI ke jawab mein conditions nahi thin");
    }

    const riskLevel = String(raw.riskLevel || "").toLowerCase();

    return {
        possibleConditions,
        riskLevel: ["low", "medium", "high"].includes(riskLevel) ? riskLevel : "medium",
        suggestedTests: cleanList(raw.suggestedTests),
        advice: String(raw.advice || "").trim(),
        disclaimer: SYMPTOM_DISCLAIMER,
    };
};

// AI na chale to ye simple keyword check chalega
const RED_FLAGS = [
    "chest pain", "shortness of breath", "difficulty breathing", "unconscious",
    "seizure", "severe bleeding", "paralysis", "stroke",
    "seene mein dard", "saans lene mein", "behosh",
];
const MEDIUM_FLAGS = [
    "high fever", "vomiting", "diarrhea", "dizziness", "dehydration",
    "bukhar", "ulti", "chakkar",
];

const fallbackSymptomCheck = ({ symptoms, age }) => {
    const text = symptoms.toLowerCase();
    const hasAge = age !== undefined && age !== null && age !== "";
    const isRisky = RED_FLAGS.some((word) => text.includes(word));
    const isMedium =
        MEDIUM_FLAGS.some((word) => text.includes(word)) ||
        (hasAge && (Number(age) < 5 || Number(age) > 65));

    const riskLevel = isRisky ? "high" : isMedium ? "medium" : "low";

    const suggestedTests = ["Basic vitals check (BP, temperature, pulse)", "CBC (Complete Blood Count)"];
    if (riskLevel === "high") {
        suggestedTests.unshift("Immediate emergency evaluation");
    }

    return {
        possibleConditions: [],
        riskLevel,
        suggestedTests,
        advice: "AI abhi available nahi hai. Ye sirf basic keyword check hai, doctor khud assessment karein.",
        disclaimer: SYMPTOM_DISCLAIMER,
    };
};

export const symptomChecker = async (req, res) => {
    try {
        // Patient ka naam AI ko nahi bhejte, sirf medical maloomat
        const { symptoms, age, gender, history } = req.body;

        try {
            const raw = await askGeminiJSON(buildSymptomPrompt({ symptoms, age, gender, history }));
            const result = normalizeSymptomResult(raw);
            return res.json({ source: "ai", aiAvailable: true, result });
        } catch (error) {
            // AI fail hua, lekin system band nahi hoga
            console.log("AI fail hua (symptom checker):", error.message);
            return res.json({
                source: "fallback",
                aiAvailable: false,
                message: "AI abhi available nahi hai, basic check dikhaya ja raha hai",
                result: fallbackSymptomCheck({ symptoms, age }),
            });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ======================================================
//  2. PRESCRIPTION EXPLANATION (patient ya doctor)
// ======================================================

const LANGUAGE_RULES = {
    english: "Write everything in simple English.",
    "roman-urdu":
        "Write everything in simple Roman Urdu (Urdu written in English letters, for example: 'Ye dawai din mein 3 baar lein').",
    urdu: "Write everything in simple Urdu using Urdu script (اردو).",
};

const DISCLAIMERS = {
    english: "This is general information generated by AI. It does not replace your doctor's advice.",
    "roman-urdu": "Ye AI ki di hui aam maloomat hai. Ye aapke doctor ke mashware ki jagah nahi leti.",
    urdu: "یہ AI کی دی ہوئی عمومی معلومات ہے۔ یہ آپ کے ڈاکٹر کے مشورے کی جگہ نہیں لیتی۔",
};

// AI na chale to ye taiyar jawab chalega (english aur roman urdu)
const TEMPLATES = {
    english: {
        summary: (n) =>
            `Your doctor has prescribed ${n} medicine(s). Please take them exactly as written and finish the full course.`,
        purpose: "As advised by your doctor",
        lifestyleTips: [
            "Drink plenty of clean water",
            "Take enough rest and sleep",
            "Eat light, healthy and home-cooked food",
        ],
        preventiveAdvice: [
            "Wash your hands regularly",
            "Complete the full course of medicines, do not stop in the middle",
            "Do not take extra medicines without asking your doctor",
        ],
        whenToSeeDoctor: [
            "If your symptoms get worse",
            "If you get a rash, vomiting or any side effect",
            "If you do not feel better after finishing the course",
        ],
        disclaimer: DISCLAIMERS.english,
    },
    "roman-urdu": {
        summary: (n) =>
            `Aapke doctor ne ${n} dawai(yan) likhi hain. Inhein bilkul waise hi lein jaise likha hai aur course poora karein.`,
        purpose: "Doctor ke mashware ke mutabiq",
        lifestyleTips: [
            "Saaf pani zyada piyein",
            "Poora aaraam aur neend lein",
            "Halka, saaf aur ghar ka bana khana khayein",
        ],
        preventiveAdvice: [
            "Haath baar baar dhoyein",
            "Dawai ka course poora karein, beech mein na chhorein",
            "Doctor se poochay baghair koi extra dawai na lein",
        ],
        whenToSeeDoctor: [
            "Agar alamaat barh jayen",
            "Agar rash, ulti ya koi side effect ho",
            "Agar course ke baad bhi aaram na aaye",
        ],
        disclaimer: DISCLAIMERS["roman-urdu"],
    },
};

const buildExplainPrompt = ({ prescription, diagnosisText, language }) => {
    const medicineLines = prescription.medicines
        .map((m, i) => `${i + 1}. ${m.name} | Dosage: ${m.dosage} | Frequency: ${m.frequency || "not given"} | Duration: ${m.duration || "not given"}`)
        .join("\n");

    return `You are a friendly medical assistant. Explain a doctor's prescription to the patient in very simple words.

Patient: age ${prescription.patient.age ?? "not given"}, gender ${prescription.patient.gender || "not given"}
Diagnosis: ${diagnosisText || "not given"}
Medicines prescribed:
${medicineLines}
Doctor's notes: ${prescription.notes || "none"}

${LANGUAGE_RULES[language]}

Reply with JSON in exactly this shape (keep the JSON keys in English):
{
  "summary": "2-3 simple sentences about what this prescription is for",
  "medicines": [{ "purpose": "what this medicine is usually used for, in simple words", "howToTake": "how to take it, following the doctor's dosage exactly" }],
  "lifestyleTips": ["string"],
  "preventiveAdvice": ["string"],
  "whenToSeeDoctor": ["warning signs when the patient should contact the doctor"]
}

Rules: List the medicines in the same order as above. Never change the doctor's dosage. Never add new medicines. Do not give a new diagnosis. Keep every point short and easy to understand.`;
};

const normalizeExplanation = (raw, prescription, language) => {
    const summary = String(raw.summary || "").trim();
    if (!summary) {
        throw new Error("AI ke jawab mein summary nahi thi");
    }

    const aiMedicines = Array.isArray(raw.medicines) ? raw.medicines : [];

    return {
        summary,
        // Naam aur dosage hamesha doctor ki likhi hui hi rahegi, AI sirf wazahat likhta hai
        medicines: prescription.medicines.map((m, i) => ({
            name: m.name,
            dosage: m.dosage,
            frequency: m.frequency || "",
            duration: m.duration || "",
            purpose: String(aiMedicines[i]?.purpose || "").trim(),
            howToTake: String(aiMedicines[i]?.howToTake || "").trim(),
        })),
        doctorNotes: prescription.notes || "",
        lifestyleTips: cleanList(raw.lifestyleTips),
        preventiveAdvice: cleanList(raw.preventiveAdvice),
        whenToSeeDoctor: cleanList(raw.whenToSeeDoctor),
        disclaimer: DISCLAIMERS[language],
    };
};

const buildFallbackExplanation = (prescription, language) => {
    const t = TEMPLATES[language];

    return {
        summary: t.summary(prescription.medicines.length),
        medicines: prescription.medicines.map((m) => ({
            name: m.name,
            dosage: m.dosage,
            howToTake: [m.dosage, m.frequency, m.duration].filter(Boolean).join(", "),
            duration: m.duration || "",
            purpose: t.purpose,
            howToTake: m.duration ? `${m.dosage} (${m.duration})` : m.dosage,
        })),
        doctorNotes: prescription.notes || "",
        lifestyleTips: t.lifestyleTips,
        preventiveAdvice: t.preventiveAdvice,
        whenToSeeDoctor: t.whenToSeeDoctor,
        disclaimer: t.disclaimer,
    };
};

export const explainPrescription = async (req, res) => {
    try {
        const prescription = await Prescription.findById(req.params.id).populate("patient");

        if (!prescription) {
            return res.status(404).json({ message: "Prescription nahi mili" });
        }

        // Patient sirf apni prescription, doctor sirf apni likhi hui dekh sakta hai
        if (req.user.role === "patient") {
            const me = await Patient.findOne({ user: req.user._id });
            if (!me || prescription.patient._id.toString() !== me._id.toString()) {
                return res.status(403).json({ message: "Ye aapki prescription nahi hai" });
            }
        }

        if (req.user.role === "doctor" && prescription.doctor.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Ye aapki likhi hui prescription nahi hai" });
        }

        const language = req.body.language || "english";

        // Diagnosis (agar likhi gayi ho) to AI ko behtar explanation ke liye dein
        let diagnosisText = "";
        if (prescription.appointment) {
            const diagnosis = await Diagnosis.findOne({ appointment: prescription.appointment });
            if (diagnosis) diagnosisText = diagnosis.diagnosis;
        }

        try {
            const raw = await askGeminiJSON(buildExplainPrompt({ prescription, diagnosisText, language }));
            const explanation = normalizeExplanation(raw, prescription, language);
            return res.json({ source: "ai", aiAvailable: true, language, explanation });
        } catch (error) {
            // AI fail hua, lekin system band nahi hoga
            console.log("AI fail hua (prescription explanation):", error.message);

            // Urdu script ka taiyar jawab nahi hai, to Roman Urdu dikhayenge
            const fallbackLanguage = language === "english" ? "english" : "roman-urdu";

            return res.json({
                source: "fallback",
                aiAvailable: false,
                language: fallbackLanguage,
                message: "AI abhi available nahi hai, aam hidayat dikhayi ja rahi hain",
                explanation: buildFallbackExplanation(prescription, fallbackLanguage),
            });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};