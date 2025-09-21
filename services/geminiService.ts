
import { GoogleGenAI, Type } from "@google/genai";
import type { GenerationSettings, MetadataResult } from '../types';
import { ADOBE_STOCK_CATEGORIES } from '../constants';
import { fileToBase64 } from '../utils';

const generatePrompt = (fileName: string, settings: GenerationSettings): string => {
  const { titleLength, keywordCount, contentType } = settings;
  const contentDescription = contentType === 'image' ? `Analyze the provided image.` : `Based on the video filename, infer its content.`;

  return `
    You are an expert metadata generator for Adobe Stock. ${contentDescription}
    The file name is "${fileName}".

    Generate metadata that strictly adheres to the following rules, in the specified JSON format.

    RULES:
    1.  **Title**: Must be between ${MIN_TITLE_LENGTH} and ${titleLength} characters long. It should be descriptive, concise, and SEO-friendly.
    2.  **Keywords**: Generate exactly ${keywordCount} keywords. Order them from most to least relevant. Include synonyms, conceptual terms, and variations.
    3.  **Category**: Select the single most relevant category from this exact list: [${ADOBE_STOCK_CATEGORIES.join(", ")}].
    4.  **Content**: All metadata must strictly and accurately describe the visual content.
    5.  **Restrictions**: Do not include watermarks, brand names, or any prohibited terms.
    6.  **Response Format**: Respond ONLY with a valid JSON object matching the provided schema. Do not include any other text, markdown, or explanations.

    The filename for this content is "${fileName}".
  `;
};

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        file_name: { type: Type.STRING },
        title: { type: Type.STRING },
        keywords: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
        },
        category: { type: Type.STRING },
    },
    required: ["file_name", "title", "keywords", "category"],
};

const MIN_TITLE_LENGTH = 5;

const callGeminiApi = async (
    file: File,
    settings: GenerationSettings,
    apiKey: string
): Promise<MetadataResult> => {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = generatePrompt(file.name, settings);

    let parts: any[] = [{ text: prompt }];

    if (settings.contentType === 'image') {
        const base64Data = await fileToBase64(file);
        parts.unshift({
            inlineData: {
                mimeType: file.type,
                data: base64Data,
            },
        });
    }

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: parts },
        config: {
            responseMimeType: 'application/json',
            responseSchema: responseSchema,
            temperature: 0.5,
        }
    });

    const text = response.text.trim();
    try {
        const result = JSON.parse(text);
        if (result.keywords.length > settings.keywordCount) {
            result.keywords = result.keywords.slice(0, settings.keywordCount);
        }
        return result as MetadataResult;
    } catch (e) {
        console.error("Failed to parse Gemini response as JSON:", text);
        throw new Error("Invalid JSON response from API");
    }
};

export const generateMetadataForFile = async (
    file: File,
    settings: GenerationSettings,
    apiKeys: string[]
): Promise<MetadataResult> => {
    let lastError: Error | null = null;
    for (const key of apiKeys) {
        try {
            const result = await callGeminiApi(file, settings, key);
            return result;
        } catch (error) {
            lastError = error as Error;
            console.warn(`API key ending in ...${key.slice(-4)} failed for file ${file.name}. Trying next key.`, error);
        }
    }
    throw new Error(`All API keys failed for file ${file.name}. Last error: ${lastError?.message}`);
};
