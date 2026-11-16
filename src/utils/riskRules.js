// Risk flagging ke simple rules (AI ki zaroorat nahi, isliye hamesha chalta hai)

const DAY = 24 * 60 * 60 * 1000;

const INFECTION_WORDS = [
    "infection", "fever", "flu", "cold", "cough", "throat", "tonsillitis", "uti",
    "urinary", "pneumonia", "bronchitis", "typhoid", "diarrhea", "gastro", "sinusitis", "bukhar",
];

const CHRONIC_WORDS = [
    "diabetes", "hypertension", "high blood pressure", "asthma", "copd",
    "kidney disease", "heart disease", "thyroid", "arthritis", "epilepsy",
];

const SYMPTOM_WORDS = [
    "headache", "cough", "fever", "fatigue", "dizziness", "nausea",
    "vomiting", "chest pain", "back pain", "joint pain", "stomach pain",
];

// Khatarnak combinations: har rule ke "needs" mein har group se kam az kam 1 lafz milna chahiye
const COMBOS = [
    {
        severity: "high",
        title: "Seene mein dard ke saath saans ki takleef",
        needs: [["chest pain"], ["shortness of breath", "difficulty breathing", "breathlessness"]],
    },
    {
        severity: "high",
        title: "60 saal ya zyada umar mein seene ka dard",
        needs: [["chest pain"]],
        minAge: 60,
    },
    {
        severity: "high",
        title: "Diabetes ke saath infection ya zakhm",
        needs: [["diabetes"], ["infection", "wound", "ulcer", "gangrene"]],
    },
    {
        severity: "high",
        title: "Blood pressure ke saath khatarnak alamaat",
        needs: [["hypertension", "high blood pressure"], ["severe headache", "chest pain", "blurred vision"]],
    },
    {
        severity: "high",
        title: "Bukhar ke saath gardan ki akRan",
        needs: [["fever"], ["stiff neck"]],
    },
    {
        severity: "medium",
        title: "Chote bachay (5 saal se kam) ko bukhar",
        needs: [["fever"]],
        maxAge: 4,
    },
];

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

// "uti" jaise chhote lafz "routine" ke andar na milen, is liye lafz ki hadd (boundary) dekhte hain
const hasWord = (text, word) => new RegExp(`\\b${word}(s|es)?\\b`, "i").test(text);
const hasAny = (text, words) => words.some((w) => hasWord(text, w));
const findWords = (text, words) => words.filter((w) => hasWord(text, w));

const clean = (text) => String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
const daysAgo = (date, now) => (now - new Date(date)) / DAY;

const analyzeRisk = ({ diagnoses = [], patient = {}, now = new Date() }) => {
    const flags = [];
    const within = (days) => diagnoses.filter((d) => daysAgo(d.createdAt, now) <= days);

    // 1. Baar baar infection (pichle 90 din mein 3 ya zyada)
    const infections = within(90).filter((d) => hasAny(d.diagnosis || "", INFECTION_WORDS));
    const repeatedInfection = infections.length >= 3;
    if (repeatedInfection) {
        const names = [...new Set(infections.map((d) => clean(d.diagnosis)))].slice(0, 5).join(", ");
        flags.push({
            type: "repeated_infection",
            severity: infections.length >= 4 ? "high" : "medium",
            title: "Baar baar infection",
            detail: `Pichle 90 din mein ${infections.length} dafa infection ya bukhar ki diagnosis hui: ${names}`,
        });
    }

    // 2. Wohi diagnosis baar baar (pichle 180 din mein 3 ya zyada)
    const counts = {};
    within(180).forEach((d) => {
        const name = clean(d.diagnosis);
        if (name) counts[name] = (counts[name] || 0) + 1;
    });
    Object.entries(counts).forEach(([name, count]) => {
        if (count < 3) return;
        // Infection pehle hi flag ho chuka hai to dobara nahi
        if (repeatedInfection && hasAny(name, INFECTION_WORDS)) return;
        flags.push({
            type: "recurring_diagnosis",
            severity: count >= 5 ? "high" : "medium",
            title: "Wohi bimari baar baar",
            detail: `Pichle 180 din mein "${name}" ki diagnosis ${count} dafa hui`,
        });
    });

    // 3. Chronic condition (diagnosis ya patient ke medical notes mein)
    const recordText = diagnoses.map((d) => d.diagnosis || "").join(" ") + " " + (patient.medicalNotes || "");
    const chronicFound = findWords(recordText, CHRONIC_WORDS);
    if (chronicFound.length > 0) {
        flags.push({
            type: "chronic_condition",
            severity: "medium",
            title: "Chronic condition record mein hai",
            detail: `Record mein ye mojood hain: ${chronicFound.join(", ")}`,
        });
    }

    // 4. Wohi symptom baar baar (pichle 180 din mein 3 ya zyada visits mein)
    const symptomCounts = {};
    within(180).forEach((d) => {
        findWords(d.symptoms || "", SYMPTOM_WORDS).forEach((w) => {
            symptomCounts[w] = (symptomCounts[w] || 0) + 1;
        });
    });
    const repeatedSymptoms = Object.entries(symptomCounts).filter(([, c]) => c >= 3);
    if (repeatedSymptoms.length > 0) {
        flags.push({
            type: "recurring_symptom",
            severity: "medium",
            title: "Wohi symptom baar baar",
            detail: repeatedSymptoms.map(([w, c]) => `${w} (${c} dafa)`).join(", "),
        });
    }

    // 5. Khatarnak combinations (pichle 180 din ki diagnosis aur symptoms + medical notes)
    const comboText =
        within(180).map((d) => `${d.diagnosis || ""} ${d.symptoms || ""}`).join(" ") + " " + (patient.medicalNotes || "");
    const age = patient.age;
    const hasAge = age !== undefined && age !== null && age !== "";

    COMBOS.forEach((rule) => {
        if (rule.minAge !== undefined && !(hasAge && Number(age) >= rule.minAge)) return;
        if (rule.maxAge !== undefined && !(hasAge && Number(age) <= rule.maxAge)) return;

        const matched = [];
        for (const group of rule.needs) {
            const found = findWords(comboText, group);
            if (found.length === 0) return;
            matched.push(found[0]);
        }

        flags.push({
            type: "high_risk_combination",
            severity: rule.severity,
            title: rule.title,
            detail: `Mili hui alamaat: ${matched.join(" + ")}`,
        });
    });

    flags.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

    const riskLevel = flags.length === 0 ? "low" : flags[0].severity;
    return { riskLevel, flags };
};

export default analyzeRisk;