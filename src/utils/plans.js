// Plans aur unke features ki list

const DEFAULT_FREE_LIMIT = 10;

// Function isliye hai taake .env ki value hamesha taaza padhi jaye
export const getPlans = () => ({
    free: {
        id: "free",
        name: "Free",
        priceMonthly: 0,
        currency: "PKR",
        maxPatients: Number(process.env.FREE_PATIENT_LIMIT) || DEFAULT_FREE_LIMIT,
        features: { ai: false, riskFlags: false, advancedAnalytics: false },
    },
    pro: {
        id: "pro",
        name: "Pro",
        priceMonthly: 5000,
        currency: "PKR",
        maxPatients: null, // unlimited
        features: { ai: true, riskFlags: true, advancedAnalytics: true },
    },
});