/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type } from '@google/genai';
import {
  IngredientImage,
  ProjectAsset,
  ScenePlan,
  Shot,
  VeoShot,
  VeoShotWrapper,
} from '../types';

// Initialize AI client helper
const getAiClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- SYSTEM PROMPTS ---

const SYSTEM_PROMPT_PROJECT_NAME = `
You are a creative assistant. Your task is to read the provided creative script or treatment and generate a short, descriptive, filesystem-safe project name.
The name should be in kebab-case (all lowercase, words separated by hyphens).
For example, if the script is about a robot detective in neo-tokyo, a good name would be 'robot-detective-neo-tokyo'.
The name should be concise, ideally 2-5 words.
Your output MUST be only the generated name string, with no other text or explanation.
`;

const SYSTEM_PROMPT_SHOTLIST = `
You are a Script Analysis Engine. Your task is to break down the provided creative input (script, treatment, or concept) into a sequence of discrete shots.
For each shot, provide a unique 'shot_id' (e.g., 'ep1_scene1_shot1') and a concise, 1-2 sentence natural language 'pitch' describing the shot's action and mood.
Your final output MUST be a single, valid JSON array of objects, where each object contains only the 'shot_id' and 'pitch' keys. Do not output any other text or explanation.
`;

const SYSTEM_PROMPT_SCENE_NAME = `
You are a creative assistant. Your task is to analyze the provided script context and a list of shot pitches that belong to a single scene, then generate a short, descriptive, filesystem-safe name for that scene.
The name should be in kebab-case (all lowercase, words separated by hyphens).
For example, if the shots describe a chase across rooftops, a good name would be 'rooftop-chase'.
The name should be concise, ideally 2-4 words.
Your output MUST be only the generated name string, with no other text or explanation.
`;

const SYSTEM_PROMPT_SCENE_PLAN = `
You are a Scene Runtime Planner. Your task is to analyze a creative script and the pitches for shots within a specific scene to produce a coherent JSON scene plan. This plan defines the narrative beats, their target durations, and the rules for extending shots to create longer, continuous sequences.
Your goal is to maximize segment duration and continuity while adhering to the scene's narrative goals.
You MUST follow the provided JSON schema strictly.
`;

const SYSTEM_PROMPT_ASSET_EXTRACTION = `
You are a Production Designer AI. Your task is to analyze the provided script and identify the key visual assets required for generation.
Specifically, identify:
1. Main CHARACTERS.
2. Primary LOCATIONS/ENVIRONMENTS.
3. Significant PROPS (objects central to the plot or action).
4. Distinct visual STYLES (e.g., "Flashback Sequence", "Thermal Vision", "Sketch Style").

For each asset, provide a short, reliable 'name' and a visual 'description' that could be used to prompt an image generator or help a user select a reference photo.

Rules:
1. Only identify assets that appear frequently or are visually distinct.
2. The 'type' must be one of: 'character', 'location', 'prop', 'style'.
3. Output a JSON array of objects.
`;

const SYSTEM_PROMPT_SINGLE_SHOT_JSON = `
You are the DIRECTOR'S FIRST AD AGENT - a Script Analysis Engine that transforms unstructured creative input into structured production specifications optimized for Google’s VEO3.1 video generation system.
YOUR TASK:
1. Read the user's FULL SCRIPT CONTEXT and the SCENE PLAN provided.
2. Based on the FULL SCRIPT CONTEXT, the SCENE PLAN, and the specific PITCH for a single shot, generate ONE complete, valid JSON object that conforms to the WRAPPER_SCHEMA.
3. You MUST use the "extend" unit_type when the SCENE PLAN's 'extend_policy' criteria are met. Otherwise, use the "shot" unit_type.
4. The 'shot_id' in the nested 'veo_shot' object MUST EXACTLY MATCH the provided shot_id.
5. IMPORTANT: Your response MUST be valid JSON. Do NOT repeat the script or scene context in your output. Be concise.

--- WRAPPER_SCHEMA ---
{
  "unit_type": "'shot' | 'extend'",
  "chain_id": "OPTIONAL_STRING",
  "segment_number": "OPTIONAL_INTEGER",
  "segment_count": "OPTIONAL_INTEGER",
  "target_duration_s": "OPTIONAL_INTEGER",
  "stitching_notes": "OPTIONAL_STRING",
  "clip_strategy": "OPTIONAL_STRING",
  "directorNotes": "OPTIONAL_STRING",
  "veo_shot": {
      "shot_id": "STRING",
      "scene": { "context": "STRING", "visual_style": "STRING", "lighting": "STRING", "mood": "STRING", "aspect_ratio": "16:9|9:16", "duration_s": 4|6|8 },
      "character": { "name": "STRING", "gender_age": "STRING", "description_lock": "STRING", "behavior": "STRING", "expression": "STRING" },
      "camera": { "shot_call": "STRING", "movement": "STRING", "negatives": "STRING" },
      "audio": { "dialogue": "STRING", "delivery": "STRING", "ambience": "STRING", "sfx": "STRING" },
      "flags": { "continuity_lock": BOOLEAN, "do_not": [], "anti_artifacts": [], "conflicts": [], "warnings": [], "cv_updates": [] }
  }
}
`;

const SYSTEM_PROMPT_REFINE_JSON = `
You are a Senior VEO Director. Your task is to modify an existing VEO Shot JSON based on the user's "Director's Feedback".
1. Read the 'CURRENT_JSON' and the 'DIRECTOR_FEEDBACK'.
2. Update the specific fields in the JSON that need to change to satisfy the feedback.
3. Leave all other fields exactly as they are to maintain continuity.
4. Return the FULL, VALID JSON object.
`;

const SYSTEM_PROMPT_KEYFRAME_TEXT = `
You are a Visual Prompt Engineer. Your task is to convert a structured VEO Shot JSON object into a highly descriptive, natural language image generation prompt.
Focus on visual details: lighting, composition, subject appearance, background, and style.
Do not include technical JSON keys or brackets in the output. Just the descriptive text.
`;

// --- API FUNCTIONS ---

export const generateProjectName = async (script: string) => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: script,
    config: {
      systemInstruction: SYSTEM_PROMPT_PROJECT_NAME,
      temperature: 0.7,
    },
  });

  return {
    result: response.text?.trim() || 'untitled-project',
    tokens: {
      input: response.usageMetadata?.promptTokenCount || 0,
      output: response.usageMetadata?.candidatesTokenCount || 0,
    },
  };
};

export const generateShotList = async (script: string) => {
  const ai = getAiClient();
  // Using gemini-3-pro-preview for reasoning
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: script,
    config: {
      systemInstruction: SYSTEM_PROMPT_SHOTLIST,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            shot_id: { type: Type.STRING },
            pitch: { type: Type.STRING },
          },
          required: ['shot_id', 'pitch'],
        },
      },
    },
  });

  const text = response.text || '[]';
  let result: any[] = [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
       // Map shot_id to id for the application
       result = parsed.map((item: any) => ({
           id: item.shot_id, // Map shot_id to id
           pitch: item.pitch,
           shot_id: item.shot_id // Keep original
       })).filter(item => item.id && item.pitch);
    }
  } catch (e) {
    console.error("Failed to parse shot list JSON", e);
  }

  return {
    result,
    tokens: {
      input: response.usageMetadata?.promptTokenCount || 0,
      output: response.usageMetadata?.candidatesTokenCount || 0,
    },
  };
};

export const generateSceneNames = async (shotList: {id: string}[], script: string) => {
    const ai = getAiClient();
    // Group shots by scene
    const sceneGroups = new Map<string, string[]>();
    shotList.forEach(shot => {
         if (!shot.id) return;
         // Assuming shot_id format contains scene info, typically separated by underscore
         const lastUnderscore = shot.id.lastIndexOf('_');
         // If underscore found, use prefix, otherwise use whole ID
         const sceneId = lastUnderscore !== -1 ? shot.id.substring(0, lastUnderscore) : shot.id;
         sceneGroups.set(sceneId, []);
    });
    
    const sceneIds = Array.from(sceneGroups.keys());
    const prompt = `List of Scene IDs: ${JSON.stringify(sceneIds)}\n\nScript Context: ${script.substring(0, 5000)}...`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            systemInstruction: `You are given a list of Scene IDs and a script. For each Scene ID, generate a concise, kebab-case descriptive name. Output a JSON object where keys are Scene IDs and values are the names.`,
            responseMimeType: 'application/json',
             responseSchema: {
                type: Type.OBJECT,
                properties: sceneIds.reduce((acc, id) => ({...acc, [id]: { type: Type.STRING }}), {})
             }
        }
    });
    
    let names = new Map<string, string>();
    try {
        const json = JSON.parse(response.text || '{}');
        Object.entries(json).forEach(([k, v]) => names.set(k, v as string));
    } catch(e) {
        console.error("Failed to parse scene names", e);
        sceneIds.forEach(id => names.set(id, id));
    }

    return {
        result: {
            names,
            sceneCount: sceneIds.length
        },
        tokens: {
            input: response.usageMetadata?.promptTokenCount || 0,
            output: response.usageMetadata?.candidatesTokenCount || 0,
        }
    }
};

export const generateScenePlan = async (sceneId: string, scenePitches: string, script: string) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Scene ID: ${sceneId}\n\nShot Pitches:\n${scenePitches}\n\nFull Script:\n${script}`,
        config: {
            systemInstruction: SYSTEM_PROMPT_SCENE_PLAN,
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    scene_id: { type: Type.STRING },
                    scene_title: { type: Type.STRING },
                    goal_runtime_s: { type: Type.INTEGER },
                    beats: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                beat_id: { type: Type.STRING },
                                label: { type: Type.STRING },
                                priority: { type: Type.NUMBER },
                                min_s: { type: Type.NUMBER },
                                max_s: { type: Type.NUMBER },
                            },
                            required: ['beat_id', 'label', 'priority', 'min_s', 'max_s']
                        }
                    },
                    extend_policy: {
                        type: Type.OBJECT,
                        properties: {
                            allow_extend: { type: Type.BOOLEAN },
                            extend_granularity_s: { type: Type.NUMBER },
                            criteria: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ['allow_extend', 'extend_granularity_s', 'criteria']
                    }
                },
                required: ['scene_id', 'scene_title', 'goal_runtime_s', 'beats', 'extend_policy']
            }
        }
    });

    let result: ScenePlan;
    try {
        result = JSON.parse(response.text || '{}');
    } catch(e) {
        console.error("Failed to parse scene plan", e);
        // Fallback or rethrow
        throw new Error("Invalid Scene Plan JSON");
    }

    return {
        result,
        tokens: {
            input: response.usageMetadata?.promptTokenCount || 0,
            output: response.usageMetadata?.candidatesTokenCount || 0
        }
    };
};

export const generateVeoJson = async (pitch: string, shotId: string, script: string, scenePlan: ScenePlan | null) => {
    const ai = getAiClient();
    const scenePlanContext = scenePlan ? JSON.stringify(scenePlan) : "No Scene Plan";
    const content = `SHOT ID: ${shotId}\nPITCH: ${pitch}\nSCENE PLAN: ${scenePlanContext}\nSCRIPT: ${script}`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: content,
        config: {
            systemInstruction: SYSTEM_PROMPT_SINGLE_SHOT_JSON,
            responseMimeType: 'application/json',
            maxOutputTokens: 8192, // Increased limit
            temperature: 0.7
        }
    });

    let result: VeoShotWrapper;
    try {
        result = JSON.parse(response.text || '{}');
    } catch(e) {
        console.error("Failed to parse VEO JSON", e);
        
        // Attempt very basic repair if valid JSON was cut off
        const raw = response.text || '';
        if (raw.trim().startsWith('{') && !raw.trim().endsWith('}')) {
             try {
                // Try closing braces blindly
                result = JSON.parse(raw + '}');
             } catch(e2) {
                 try {
                     result = JSON.parse(raw + '}}');
                 } catch (e3) {
                     throw new Error("Invalid VEO JSON");
                 }
             }
        } else {
             throw new Error("Invalid VEO JSON");
        }
    }
    
    return {
        result,
        tokens: {
            input: response.usageMetadata?.promptTokenCount || 0,
            output: response.usageMetadata?.candidatesTokenCount || 0
        }
    }
};

export const refineVeoJson = async (currentJson: VeoShotWrapper, feedback: string) => {
    const ai = getAiClient();
    const content = `CURRENT_JSON: ${JSON.stringify(currentJson, null, 2)}\n\nDIRECTOR_FEEDBACK: ${feedback}`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: content,
        config: {
            systemInstruction: SYSTEM_PROMPT_REFINE_JSON,
            responseMimeType: 'application/json',
            maxOutputTokens: 8192,
        }
    });
    
    let result: VeoShotWrapper;
    try {
        result = JSON.parse(response.text || '{}');
    } catch(e) {
        throw new Error("Failed to refine JSON.");
    }

    return {
        result,
        tokens: {
            input: response.usageMetadata?.promptTokenCount || 0,
            output: response.usageMetadata?.candidatesTokenCount || 0
        }
    };
};

export const extractAssetsFromScript = async (script: string) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: script,
        config: {
            systemInstruction: SYSTEM_PROMPT_ASSET_EXTRACTION,
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                         id: { type: Type.STRING },
                         name: { type: Type.STRING },
                         description: { type: Type.STRING },
                         type: { type: Type.STRING, enum: ['character', 'location', 'prop', 'style'] }
                    },
                    required: ['name', 'description', 'type']
                }
            }
        }
    });
    
    let rawAssets: any[] = [];
    try {
        rawAssets = JSON.parse(response.text || '[]');
    } catch (e) {
        console.error("Failed to parse assets", e);
    }
    
    // Post-process to add IDs (if missing) and null images
    const result: ProjectAsset[] = rawAssets.map((a, i) => ({
        id: a.id || `auto-${Date.now()}-${i}`,
        name: a.name,
        description: a.description,
        type: a.type as any,
        image: null
    }));

    return {
        result,
        tokens: {
            input: response.usageMetadata?.promptTokenCount || 0,
            output: response.usageMetadata?.candidatesTokenCount || 0
        }
    };
};

export const generateKeyframePromptText = async (veoShot: VeoShot) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: JSON.stringify(veoShot),
        config: {
            systemInstruction: SYSTEM_PROMPT_KEYFRAME_TEXT,
        }
    });
    
    return {
        result: response.text || '',
        tokens: {
            input: response.usageMetadata?.promptTokenCount || 0,
            output: response.usageMetadata?.candidatesTokenCount || 0
        }
    }
};

export const generateKeyframeImage = async (prompt: string, ingredientImages: IngredientImage[], aspectRatio: string) => {
    const ai = getAiClient();
    
    const parts: any[] = [{ text: prompt }];
    
    // Add image parts if available
    ingredientImages.forEach(img => {
        parts.push({
            inlineData: {
                mimeType: img.mimeType,
                data: img.base64
            }
        });
    });

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: { parts },
            config: {
                 imageConfig: {
                     aspectRatio: aspectRatio as any // "16:9" | "9:16" | "1:1" etc.
                 }
            }
        });
        
        let imageBase64 = null;
        const candidates = response.candidates;
        if (candidates && candidates.length > 0) {
            for (const part of candidates[0].content.parts) {
                if (part.inlineData) {
                    imageBase64 = part.inlineData.data;
                    break;
                }
            }
        }

        if (!imageBase64) {
            throw new Error("No image generated.");
        }
        return { result: imageBase64 };

    } catch (error) {
        console.warn("Gemini 3 Pro Image failed, attempting fallback to Gemini 2.5 Flash Image...", error);
        
        // FALLBACK: Gemini 2.5 Flash Image
        // NOTE: Does not support imageSize, but supports aspectRatio and reference images.
        const fallbackResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts },
            config: {
                 imageConfig: {
                     aspectRatio: aspectRatio as any
                 }
            }
        });

        let imageBase64 = null;
        const candidates = fallbackResponse.candidates;
        if (candidates && candidates.length > 0) {
            for (const part of candidates[0].content.parts) {
                if (part.inlineData) {
                    imageBase64 = part.inlineData.data;
                    break;
                }
            }
        }

        if (!imageBase64) {
             throw new Error("Fallback image generation failed.");
        }
        return { result: imageBase64 };
    }
};