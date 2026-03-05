import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Gemini model name used across the app.
 * Change here to upgrade/downgrade the model globally.
 */
export const GEMINI_MODEL = "gemini-2.5-flash";

/** Shared Gemini client instance */
export const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
