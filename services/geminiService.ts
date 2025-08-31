import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    console.warn("API_KEY is not set. AI features will be disabled.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

const generateText = async (prompt: string): Promise<string> => {
    if (!API_KEY) {
        return "AI is disabled. Please configure your API key.";
    }
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                thinkingConfig: { thinkingBudget: 0 } 
            }
        });
        return response.text;
    } catch (error: any) {
        console.error("Error generating text:", error);
        if (error?.error?.status === 'RESOURCE_EXHAUSTED') {
            return "Rate limit exceeded. Please wait a moment and try again.";
        }
        if (error?.error?.message) {
            return `AI Error: ${error.error.message}`;
        }
        return "An error occurred while communicating with the AI.";
    }
};

export const generatePaletteDescription = (mood: string, colors: string[]) => {
    const prompt = `The user chose the mood "${mood}". The generated color palette is [${colors.join(', ')}]. Write a short, poetic, one-sentence description for this palette.`;
    return generateText(prompt);
};

export const generateWittyComment = (result: string) => {
    const prompt = `A decision spinner landed on "${result}". Write a very short, witty, and motivational comment about this choice (max 10 words).`;
    return generateText(prompt);
};

export const generateMotivationalMessage = () => {
    const prompt = `Generate a short, powerful motivational message (one sentence) for someone who just finished a focus session.`;
    return generateText(prompt);
};

export const generateProductivityTip = () => {
    const prompt = `Provide one concise, actionable productivity tip.`;
    return generateText(prompt);
};

export const generateEmojiStory = (keyword: string) => {
    const prompt = `Generate a sequence of 5-8 emojis that tell a story about "${keyword}". Respond with emojis only, no text, no formatting.`;
    return generateText(prompt);
};

export const generateEmojiCaption = (emojis: string) => {
    const prompt = `Write a short, funny, one-sentence caption for this emoji story: ${emojis}`;
    return generateText(prompt);
};

export const generateGreetingCaption = (type: 'morning' | 'night', emojis: string) => {
    const prompt = type === 'morning' 
        ? `This emoji story represents "Good morning": ${emojis}. Write a short, cheerful, and creative good morning message to go with it.`
        : `This emoji story represents "Good night": ${emojis}. Write a short, calming, and sweet good night message to go with it.`;
    return generateText(prompt);
};

export const rewriteGratitudeEntry = (entry: string) => {
    const prompt = `Rewrite this gratitude journal entry to be more poetic and positive, but keep it concise: "${entry}"`;
    return generateText(prompt);
};

export const generateDailyAffirmation = () => {
    const prompt = `Generate a short, uplifting daily affirmation.`;
    return generateText(prompt);
};