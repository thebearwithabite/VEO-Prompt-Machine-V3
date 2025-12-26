
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type } from '@google/genai';
import {
  IngredientImage,
  ProjectAsset,
  ScenePlan,
  VeoShot,
  VeoShotWrapper,
  Shot,
} from '../types';

/**
 * Creates a fresh GoogleGenAI instance for each API call.
 * This ensures the most up-to-date API key (from process.env.API_KEY) is used.
 */
const getAiClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- VISION AGENT PROMPTS ---

const SYSTEM_PROMPT_VISION_IDENTITY = `
You are a Visual Forensic Agent for Aether Studio. Your task is to analyze the provided image of a character, location, or prop and generate a "Visual Identity Manifest".
1. DESCRIBE the entity in exhaustive visual detail (clothing, texture, color palette, lighting).
2. For CHARACTERS: identify facial structure, hair, and specific "Visual Anchors" for VEO consistency.
3. For LOCATIONS: identify architectural style, mood, and key sets.
4. GENERATE a semantic summary that can be used to re-match this entity across different narrative contexts.
Return a valid JSON object: { visual_fingerprint: string, visual_anchors: string[], mood_profile: string, detailed_description: string }.
`;

// --- API FUNCTIONS ---

/**
 * Summarizes the project for the 'Learning Loop' registry.
 */
export const generateProjectSummary = async (projectName: string, assets: ProjectAsset[], shots: Shot[]) => {
    const ai = getAiClient();
    const context = `Project: ${projectName}\nAssets: ${assets.map(a => a.name).join(', ')}\nShots: ${shots.map(s => s.pitch).join('; ')}`;
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze this production metadata and summarize its core creative "DNA" (theme, visual style, key artifacts) in two dense sentences for a semantic registry:\n${context}`
    });
    return response.text?.trim() || '';
};

/**
 * Uses Gemini Vision to fingerprints a visual asset.
 */
export const analyzeVisualIdentity = async (base64: string, mimeType: string) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview', 
        contents: {
            parts: [
                { text: SYSTEM_PROMPT_VISION_IDENTITY },
                { inlineData: { mimeType, data: base64 } }
            ]
        },
        config: { responseMimeType: 'application/json' }
    });

    try {
        return JSON.parse(response.text || '{}');
    } catch (e) {
        throw new Error("Visual Analysis Failed.");
    }
};

/**
 * Generates embeddings for semantic search (Vector Library).
 */
export const embedArtifactData = async (text: string) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Compress the following narrative artifact into a dense semantic string for vector-lite storage:\n${text}`
    });
    return response.text?.trim() || '';
};

export const generateProjectName = async (script: string) => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: script,
    config: {
      systemInstruction: "Generate a short, kebab-case, filesystem-safe name for this script (e.g. 'cyber-noir-e1'). Only return the string.",
    },
  });
  return {
    result: response.text?.trim() || 'untitled-project',
    tokens: { input: response.usageMetadata?.promptTokenCount || 0, output: response.usageMetadata?.candidatesTokenCount || 0 }
  };
};

export const generateShotList = async (script: string) => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: script,
    config: {
      systemInstruction: "Break the script into shots. Return JSON array: [{shot_id: string, pitch: string}]",
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: { shot_id: { type: Type.STRING }, pitch: { type: Type.STRING } },
          required: ['shot_id', 'pitch'],
        },
      },
    },
  });
  return {
    result: JSON.parse(response.text || '[]'),
    tokens: { input: response.usageMetadata?.promptTokenCount || 0, output: response.usageMetadata?.candidatesTokenCount || 0 }
  };
};

export const generateSceneNames = async (shotList: any[], script: string) => {
    const ai = getAiClient();
    const sceneIds = Array.from(new Set(shotList.map(s => s.shot_id.split('_')[0])));
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Scene IDs: ${JSON.stringify(sceneIds)}. Script: ${script.slice(0, 2000)}`,
        config: {
            systemInstruction: "Assign names to these Scene IDs. Output JSON: {id: name}",
            responseMimeType: 'application/json'
        }
    });
    let names = new Map<string, string>();
    try {
        const json = JSON.parse(response.text || '{}');
        Object.entries(json).forEach(([k, v]) => names.set(k, v as string));
    } catch(e) {}
    return { result: { names }, tokens: { input: 0, output: 0 } };
};

export const generateVeoJson = async (pitch: string, shotId: string, script: string, plan: any) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `UNIT: ${shotId}. PITCH: ${pitch}. CONTEXT: ${script}`,
        config: {
            systemInstruction: "Generate VEO 3.1 JSON prompt. Use wrapper schema: {unit_type: 'shot', veo_shot: {...}}",
            responseMimeType: 'application/json',
        }
    });
    return { result: JSON.parse(response.text || '{}'), tokens: { input: 0, output: 0 } };
};

export const extractAssetsFromScript = async (script: string) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: script,
        config: {
            systemInstruction: "Identify CHARACTERS, LOCATIONS, and PROPS. Output JSON array: [{name, description, type}]",
            responseMimeType: 'application/json'
        }
    });
    const result: ProjectAsset[] = JSON.parse(response.text || '[]').map((a: any, i: number) => ({
        id: `lib_${Date.now()}_${i}`,
        name: a.name,
        description: a.description,
        type: a.type as any,
        image: null
    }));
    return { result, tokens: { input: 0, output: 0 } };
};

export const generateKeyframePromptText = async (veoShot: VeoShot) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: JSON.stringify(veoShot),
        config: { systemInstruction: "Convert VEO JSON to a cinematic image prompt. Natural language only." }
    });
    return { result: response.text || '', tokens: { input: 0, output: 0 } };
};

export const generateKeyframeImage = async (prompt: string, ingredients: IngredientImage[], aspectRatio: string) => {
    const ai = getAiClient();
    const parts: any[] = [{ text: prompt }];
    ingredients.forEach(img => parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } }));

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts },
        config: { imageConfig: { aspectRatio: aspectRatio as any, imageSize: "1K" } }
    });
    
    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return { result: part.inlineData.data };
    }
    throw new Error("Generation error.");
};

export const refineVeoJson = async (current: any, feedback: string) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `FEEDBACK: ${feedback}. CURRENT: ${JSON.stringify(current)}`,
        config: { systemInstruction: "Update the JSON based on director feedback. Maintain all other fields.", responseMimeType: 'application/json' }
    });
    return { result: JSON.parse(response.text || '{}'), tokens: { input: 0, output: 0 } };
};

export const generateVeoExtensionJson = async (prev: any, plan: any) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: JSON.stringify(prev),
        config: { systemInstruction: "Create 'extend' unit. Advance the narrative slightly while maintaining visual lock.", responseMimeType: 'application/json' }
    });
    return { result: JSON.parse(response.text || '{}'), tokens: { input: 0, output: 0 } };
};
