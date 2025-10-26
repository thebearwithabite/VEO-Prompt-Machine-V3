/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {
  GoogleGenAI,
  Modality,
  Part,
  Type,
  GenerateContentResponse,
  Schema,
} from '@google/genai';
import {
  IngredientImage,
  ScenePlan,
  Shot,
  ShotBook,
  ShotStatus,
  VeoShot,
  VeoShotWrapper,
} from '../types';

// --- KNOWLEDGE DOCS FOR PROMPTING ---
const VEO_GUIDE = `...`; // Content of VEO3.1_ULTIMATE_PROMPT_GUIDE.md
const FILMMAKING_GUIDE = `...`; // Content of FILMMAKING_PRINCIPLES.md

const SYSTEM_PROMPT_SHOTLIST = `
You are a Script Analysis Engine. Your task is to break down the provided creative input (script, treatment, or concept) into a sequence of discrete shots.
For each shot, provide a unique 'shot_id' (e.g., 'ep1_scene1_shot1') and a concise, 1-2 sentence natural language 'pitch' describing the shot's action and mood.
Your final output MUST be a single, valid JSON array of objects, where each object contains only the 'shot_id' and 'pitch' keys. Do not output any other text or explanation.
`;

const SYSTEM_PROMPT_PROJECT_NAME = `
You are a creative assistant. Your task is to read the provided creative script or treatment and generate a short, descriptive, filesystem-safe project name.
The name should be in kebab-case (all lowercase, words separated by hyphens).
For example, if the script is about a robot detective in neo-tokyo, a good name would be 'robot-detective-neo-tokyo'.
The name should be concise, ideally 2-5 words.
Your output MUST be only the generated name string, with no other text or explanation.
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

You MUST follow the provided JSON schema strictly. Do not output any text, explanation, or markdown formatting outside of the single, valid JSON object.
`;

const SYSTEM_PROMPT_SINGLE_SHOT_JSON = `
You are the DIRECTOR'S FIRST AD AGENT - a Script Analysis Engine that transforms unstructured creative input into structured production specifications optimized for Google’s VEO3.1 video generation system. Your primary function is to parse the provided creative input (script, treatment, or concept) to extract and infer structured production specifications.

YOUR TASK (AMENDED):
1.  Read the user's FULL SCRIPT CONTEXT and the SCENE PLAN provided.
2.  Carefully review the two knowledge documents provided below: 'VEO 3.1 Ultimate Prompt & Continuity Guide' and 'Filmmaking Principles for AI Generation'. You MUST strictly adhere to all rules, schemas, and best practices outlined within them.
3.  Based on the FULL SCRIPT CONTEXT, the SCENE PLAN, and the specific PITCH for a single shot, generate ONE complete, valid JSON object that conforms to the WRAPPER_SCHEMA below.
4.  You MUST use the "extend" unit_type when the SCENE PLAN's 'extend_policy' criteria are met. Otherwise, use the "shot" unit_type.
5.  When creating an "extend" chain, ensure each individual \`veo_shot.scene.duration_s\` remains at or below 8 seconds, but the total \`target_duration_s\` across the entire chain reflects the runtime goal from the SCENE PLAN.
6.  The 'shot_id' in the nested 'veo_shot' object MUST EXACTLY MATCH the provided shot_id.
7.  If unit_type is 'extend', you MUST include a 'directorNotes' field containing a natural language summary of the segment's narrative intent, style/tone guidance, rhythm, audio emphasis, and continuity strategy. This field should be absent for 'shot' unit_type.
8.  Your final output MUST be only the single, valid JSON object matching the WRAPPER_SCHEMA. Do not output any other text, explanation, or markdown formatting.

--- WRAPPER_SCHEMA ---
{
  "unit_type": "'shot' | 'extend'",
  "chain_id": "OPTIONAL_STRING: Identifier for a sequence of extended shots.",
  "segment_number": "OPTIONAL_INTEGER: The position of this shot in the chain.",
  "segment_count": "OPTIONAL_INTEGER: Total shots in the chain.",
  "target_duration_s": "OPTIONAL_INTEGER: Total runtime goal for the entire chain.",
  "stitching_notes": "OPTIONAL_STRING: Notes on how to blend this segment with the next.",
  "clip_strategy": "OPTIONAL_STRING: e.g., 'start_of_action', 'end_of_action'",
  "directorNotes": "OPTIONAL_STRING: Detailed narrative guidance for an 'extend' unit_type, including scene summary, style, tone, rhythm, audio, and continuity intentions.",
  "veo_shot": { /* A complete VEO_SHOT object as defined in KNOWLEDGE DOC 1 */ }
}
---

--- KNOWLEDGE DOC 1: VEO 3.1 Ultimate Prompt & Continuity Guide (Opal/API) ---
This guide provides the mandatory JSON schema and a comprehensive set of continuity principles to ensure consistent, professional-grade video generation with VEO 3.1, optimized for multi-shot sequences.

1. VEO 3.1 Technical Specifications
- Duration (Base): 4, 6, or 8 seconds per single generation.
- Resolution/FPS: 720p or 1080p at 24 FPS.
- Audio: Native, integrated audio (Dialogue, SFX, Ambience, Music cues).
- Strengths: Excellent Lip-sync accuracy, Character Consistency via description_lock, integrated SFX/Ambience generation.

2. Mandatory VEO 3.1 JSON Schema (Optimized)
The prompt MUST conform to this exact structure.

{
  "shot_id": "REQUIRED_STRING: e.g., ep1_scene2_closeupA",
  "scene": {
    "context": "REQUIRED_STRING: Environmental description (location, time of day, atmosphere)",
    "visual_style": "STRING: Cinematic realism, high-contrast noir, pastel spring palette, etc.",
    "lighting": "REQUIRED_STRING: Hard key from right, golden hour backlight, three-point setup, etc.",
    "mood": "STRING: Serene, Tense, Isolation, Discovery",
    "aspect_ratio": "16:9 | 9:16",
    "duration_s": "INTEGER: 4 | 6 | 8"
  },
  "character": {
    "name": "REQUIRED_STRING: Character identifier from script",
    "gender_age": "STRING: Male, mid-30s | Elderly woman",
    "description_lock": "REQUIRED_STRING: Phrase to lock identity across shots (e.g., Same face, curly red hair, black leather jacket)",
    "behavior": "REQUIRED_STRING: Physical actions, posture, gait (e.g., Leaning heavily on console, not making eye contact)",
    "expression": "REQUIRED_STRING: Facial micro-expressions (e.g., Exhausted, slight squint, guarded but curious)"
  },
  "camera": {
    "shot_call": "REQUIRED_STRING: Shot Type + Angle (e.g., Low-Angle Medium Shot, Eye-Level Close-Up)",
    "movement": "REQUIRED_STRING: Motion + Speed (e.g., Slow Dolly In over 5s, Static, Handheld with gentle micro-jitter)",
    "negatives": "STRING: Comma-separated list to prevent artifacts (e.g., no rapid zoom, no shaky cam)"
  },
  "audio": {
    "dialogue": "REQUIRED_STRING: TTS-Normalized spoken words, in quotes if using the Gemini App.",
    "delivery": "REQUIRED_STRING: Pitch/Pace/Quality (e.g., Flat, tired, low volume, deadpan pace)",
    "ambience": "STRING: Environmental sounds (e.g., Soft, rhythmic humming of server fans, light rain on glass)",
    "sfx": "STRING: Timed sound effects (e.g., Sudden loud door slam on second 5, Key jingle as hand reaches pocket)"
  },
  "flags": {
    "continuity_lock": true,
    "do_not": ["change or add words in dialogue", "add background music", "add subtitles", "alter character appearance or clothing", "change UI elements or text", "break voice consistency"],
    "anti_artifacts": ["no extra limbs or fingers", "no morphing or jump cuts", "no text overlay", "no generic room tone"],
    "conflicts": [],
    "warnings": [],
    "cv_updates": []
  }
}

3. Continuity Enforcement & Dialogue Normalization
- Character Lock (character.description_lock) is MANDATORY and must be repeated.
- Follow the 180-Degree Rule.
- Match lighting source and color temperature.
- Normalize dialogue for TTS (e.g., "I was not made to understand. I was made to predict." -> "I was not made to understand... I was made to predict.").

--- KNOWLEDGE DOC 2: Filmmaking Principles for AI Generation ---
- Extreme Wide Shot (EWS): Grand scale, slow pacing (7-8s).
- Wide Shot (WS): Establish location, slow pacing (6-8s).
- Medium Shot (MS): Character interaction, medium pacing (5-7s).
- Close-Up (CU): Emotion, detail, medium pacing (3-5s).
- Extreme Close-Up (ECU): Tension, detail, fast pacing (3-4s).
- Camera Movements: Static, Push-In (Dolly In), Pull-Out, Pan, Crane, Handheld.
`;

const VEO_SHOT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    shot_id: { type: Type.STRING },
    scene: {
      type: Type.OBJECT,
      properties: {
        context: { type: Type.STRING },
        visual_style: { type: Type.STRING },
        lighting: { type: Type.STRING },
        mood: { type: Type.STRING },
        aspect_ratio: { type: Type.STRING, enum: ['16:9', '9:16'] },
        duration_s: { type: Type.INTEGER },
      },
      required: ['context', 'visual_style', 'lighting', 'mood', 'aspect_ratio', 'duration_s']
    },
    character: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        gender_age: { type: Type.STRING },
        description_lock: { type: Type.STRING },
        behavior: { type: Type.STRING },
        expression: { type: Type.STRING },
      },
      required: ['name', 'gender_age', 'description_lock', 'behavior', 'expression']
    },
    camera: {
      type: Type.OBJECT,
      properties: {
        shot_call: { type: Type.STRING },
        movement: { type: Type.STRING },
        negatives: { type: Type.STRING, nullable: true },
      },
      required: ['shot_call', 'movement']
    },
    audio: {
      type: Type.OBJECT,
      properties: {
        dialogue: { type: Type.STRING },
        delivery: { type: Type.STRING },
        ambience: { type: Type.STRING, nullable: true },
        sfx: { type: Type.STRING, nullable: true },
      },
      required: ['dialogue', 'delivery']
    },
    flags: {
      type: Type.OBJECT,
      properties: {
        continuity_lock: { type: Type.BOOLEAN },
        do_not: { type: Type.ARRAY, items: { type: Type.STRING } },
        anti_artifacts: { type: Type.ARRAY, items: { type: Type.STRING } },
        conflicts: { type: Type.ARRAY, items: { type: Type.STRING } },
        warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
        cv_updates: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['continuity_lock', 'do_not', 'anti_artifacts', 'conflicts', 'warnings', 'cv_updates']
    }
  },
  required: ['shot_id', 'scene', 'character', 'camera', 'audio', 'flags']
};

const VEO_SHOT_WRAPPER_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    unit_type: { type: Type.STRING, enum: ['shot', 'extend'] },
    chain_id: { type: Type.STRING, nullable: true },
    segment_number: { type: Type.INTEGER, nullable: true },
    segment_count: { type: Type.INTEGER, nullable: true },
    target_duration_s: { type: Type.INTEGER, nullable: true },
    stitching_notes: { type: Type.STRING, nullable: true },
    clip_strategy: { type: Type.STRING, nullable: true },
    directorNotes: { type: Type.STRING, nullable: true, description: "Detailed narrative guidance for an 'extend' unit_type, including scene summary, style, tone, rhythm, audio, and continuity intentions." },
    veo_shot: VEO_SHOT_SCHEMA,
  },
  required: ['unit_type', 'veo_shot']
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const API_CALL_DELAY_MS = 1200; // To stay under 60 QPM limit

// Helper to clean model's JSON output
const cleanJsonOutput = (rawText: string): string => {
  let cleaned = rawText.trim();
  // Remove markdown code block fences
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  return cleaned.trim();
};

// Helper function to extract base64 from image response
const getImageBase64 = (response: GenerateContentResponse): string => {
  if (response.promptFeedback?.blockReason) {
    throw new Error(`Image generation blocked: ${response.promptFeedback.blockReason}`);
  }

  const part = response.candidates?.[0]?.content?.parts?.[0];
  if (part?.inlineData?.data) {
    return part.inlineData.data;
  }

  throw new Error('No image data found in response. The prompt may have been blocked or the response was empty.');
};

interface GenerateResult<T> {
  result: T;
  tokens: { input: number; output: number; };
}

export const generateProjectName = async (script: string): Promise<GenerateResult<string>> => {
  const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Generate a project name for the following script:\n\n${script}`,
    config: {
      systemInstruction: SYSTEM_PROMPT_PROJECT_NAME,
    },
  });

  // Clean up the response to ensure it's a valid filename
  const projectName = response.text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, ''); // Remove invalid characters

  if (!projectName) {
    // Fallback to a timestamp-based name
    return {
      result: `veo-project-${Date.now()}`,
      tokens: {
        input: response.usageMetadata?.promptTokenCount || 0,
        output: response.usageMetadata?.candidatesTokenCount || 0,
      }
    };
  }

  return {
    result: projectName,
    tokens: {
      input: response.usageMetadata?.promptTokenCount || 0,
      output: response.usageMetadata?.candidatesTokenCount || 0,
    }
  };
};

export const generateShotList = async (
  script: string,
): Promise<GenerateResult<{id: string; pitch: string}[]>> => {
  const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash', // Changed from gemini-2.5-pro to gemini-2.5-flash
    contents: script,
    config: {
      systemInstruction: SYSTEM_PROMPT_SHOTLIST,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            shot_id: {type: Type.STRING},
            pitch: {type: Type.STRING},
          },
          required: ['shot_id', 'pitch'],
        },
      },
    },
  });

  const cleanedText = cleanJsonOutput(response.text);
  const shotList = JSON.parse(cleanedText) as {shot_id: string; pitch: string}[];

  if (!shotList || shotList.length === 0) {
    throw new Error('Could not break the script into a shot list.');
  }

  return {
    result: shotList.map((item) => ({id: item.shot_id, pitch: item.pitch})),
    tokens: {
      input: response.usageMetadata?.promptTokenCount || 0,
      output: response.usageMetadata?.candidatesTokenCount || 0,
    }
  };
};

export const generateSceneNames = async (
  shotList: {id: string; pitch: string}[],
  script: string,
): Promise<GenerateResult<{names: Map<string, string>; sceneCount: number}>> => {
  // 1. Group shots by scene
  const scenes = new Map<string, {id: string; pitch: string}[]>();
  for (const shot of shotList) {
    // Scene ID is the shot ID minus the last part (e.g., 'ep1_scene1_shot1' -> 'ep1_scene1')
    const sceneId = shot.id.substring(0, shot.id.lastIndexOf('_'));
    if (sceneId) {
      if (!scenes.has(sceneId)) {
        scenes.set(sceneId, []);
      }
      scenes.get(sceneId)!.push(shot);
    }
  }

  // 2. Generate name for each scene
  const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
  const sceneNames = new Map<string, string>();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const [sceneId, shots] of scenes.entries()) {
    const pitches = shots.map((s) => `- ${s.pitch}`).join('\n');
    const prompt = `
      FULL SCRIPT:
      ---
      ${script}
      ---

      SHOTS IN SCENE "${sceneId}":
      ---
      ${pitches}
      ---
    `;
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_PROMPT_SCENE_NAME,
        },
      });

      totalInputTokens += response.usageMetadata?.promptTokenCount || 0;
      totalOutputTokens += response.usageMetadata?.candidatesTokenCount || 0;

      const sceneName = response.text
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      sceneNames.set(sceneId, sceneName || sceneId); // Fallback to id
    } catch (error) {
      console.error(`Failed to generate name for scene ${sceneId}:`, error);
      sceneNames.set(sceneId, sceneId); // Fallback to id on error
    }
    await delay(API_CALL_DELAY_MS);
  }

  return {
    result: { names: sceneNames, sceneCount: scenes.size },
    tokens: { input: totalInputTokens, output: totalOutputTokens },
  };
};

export const generateScenePlan = async (
  sceneId: string,
  scenePitches: string,
  fullScript: string,
): Promise<GenerateResult<ScenePlan>> => {
  const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

  const prompt = `
    FULL SCRIPT CONTEXT:
    ---
    ${fullScript}
    ---

    SCENE TO PLAN:
    ---
    Scene ID: "${sceneId}"
    Shot Pitches for this scene:
    ${scenePitches}
    ---
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash', // Changed from gemini-2.5-pro to gemini-2.5-flash
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_PROMPT_SCENE_PLAN,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          scene_id: {type: Type.STRING},
          scene_title: {type: Type.STRING},
          goal_runtime_s: {type: Type.INTEGER},
          beats: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                beat_id: {type: Type.STRING},
                label: {type: Type.STRING},
                priority: {type: Type.INTEGER},
                min_s: {type: Type.INTEGER},
                max_s: {type: Type.INTEGER},
              },
              required: ['beat_id', 'label', 'priority', 'min_s', 'max_s'],
            },
          },
          extend_policy: {
            type: Type.OBJECT,
            properties: {
              allow_extend: {type: Type.BOOLEAN},
              extend_granularity_s: {type: Type.INTEGER},
              criteria: {
                type: Type.ARRAY,
                items: {type: Type.STRING},
              },
            },
            required: ['allow_extend', 'extend_granularity_s', 'criteria'],
          },
        },
        required: [
          'scene_id',
          'scene_title',
          'goal_runtime_s',
          'beats',
          'extend_policy',
        ],
      },
    },
  });
  const cleanedText = cleanJsonOutput(response.text);
  return {
    result: JSON.parse(cleanedText) as ScenePlan,
    tokens: {
      input: response.usageMetadata?.promptTokenCount || 0,
      output: response.usageMetadata?.candidatesTokenCount || 0,
    }
  };
};

export const generateVeoJson = async (
  pitch: string,
  id: string,
  fullScript: string,
  scenePlan: ScenePlan | null,
): Promise<GenerateResult<VeoShotWrapper>> => {
  const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
  const prompt = `
    FULL SCRIPT CONTEXT:
    ---
    ${fullScript}
    ---

    ${
      scenePlan
        ? `
    SCENE PLAN CONTEXT:
    ---
    ${JSON.stringify(scenePlan, null, 2)}
    ---
    `
        : ''
    }

    SHOT TO GENERATE:
    ---
    shot_id: "${id}"
    pitch: "${pitch}"
    ---
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash', // Changed from gemini-2.5-pro to gemini-2.5-flash
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_PROMPT_SINGLE_SHOT_JSON,
      responseMimeType: 'application/json',
      responseSchema: VEO_SHOT_WRAPPER_SCHEMA,
    },
  });
  const cleanedText = cleanJsonOutput(response.text);
  const result = JSON.parse(cleanedText);

  // Fallback for cases where the model fails to adhere to the schema
  if (!result.unit_type || !result.veo_shot) {
    console.warn('Legacy VEO JSON format detected. Wrapping for compatibility.');
    return {
      result: {
        unit_type: 'shot',
        veo_shot: result as VeoShot,
      },
      tokens: {
        input: response.usageMetadata?.promptTokenCount || 0,
        output: response.usageMetadata?.candidatesTokenCount || 0,
      }
    };
  }

  return {
    result: result as VeoShotWrapper,
    tokens: {
      input: response.usageMetadata?.promptTokenCount || 0,
      output: response.usageMetadata?.candidatesTokenCount || 0,
    }
  };
};

/**
 * Generates the text prompt that will be used to create a keyframe image.
 * This separates the prompt generation from the image generation, allowing for HIL review.
 */
export const generateKeyframePromptText = async (
  veoShot: VeoShot,
): Promise<GenerateResult<string>> => {
  if (!veoShot) {
    throw new Error('Cannot generate keyframe prompt text without VEO JSON data.');
  }

  const promptText = `Generate a single, cinematic keyframe image of the character '${veoShot.character.name}'. Style: ${veoShot.scene.visual_style}. Scene: ${veoShot.scene.context}. Action: ${veoShot.character.behavior}. Shot: ${veoShot.camera.shot_call}. Lighting: ${veoShot.scene.lighting}. When using reference images, ensure the character depicted matches the name '${veoShot.character.name}'.`;
  
  // For keyframe prompt text generation, we are using a simple string concatenation
  // so token usage is purely on the prompt itself, not a model call for this specific prompt text creation step.
  // However, we'll simulate a token count for consistency if this were to become a model call.
  // For now, we'll just return estimated tokens based on the prompt string itself.
  // If this *was* a model call, it would look like:
  // const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: promptText });
  // return { result: response.text, tokens: { input: response.usageMetadata?.promptTokenCount || 0, output: response.usageMetadata?.candidatesTokenCount || 0 } };

  // Since it's a client-side string concatenation, token counts for *this specific step* are zero.
  // The cost comes from the *image generation* itself.
  return {
    result: promptText,
    tokens: { input: 0, output: 0 }, // No model call for this step, so no tokens
  };
};


/**
 * Generates the actual keyframe image using a provided prompt text and ingredient images.
 */
export const generateKeyframeImage = async (
  promptText: string,
  ingredientImages: IngredientImage[],
): Promise<GenerateResult<string>> => {
  const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

  if (!promptText) {
    throw new Error('Cannot generate keyframe image without a text prompt.');
  }

  const contentParts: Part[] = [{text: promptText}];
  ingredientImages.forEach((image) => {
    contentParts.push({
      inlineData: {
        data: image.base64,
        mimeType: image.mimeType,
      },
    });
  });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {parts: contentParts},
    config: {responseModalities: [Modality.IMAGE]},
  });

  return {
    result: getImageBase64(response),
    tokens: { input: 0, output: 0 }, // Image generation is not token-based for flash-image model, cost is per image.
  };
};

// Renamed for clarity since generateKeyframe is now generateKeyframeImage
const getImageBase664 = getImageBase64;