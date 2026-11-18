import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";

// .env se keys uthata hai (server.js mein "dotenv/config" sab se pehle import hota hai)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});

// Teeno keys maujood hain ya nahi
export const isCloudinaryConfigured = () =>
    Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    );

export default cloudinary;