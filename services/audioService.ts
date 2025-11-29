/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI } from "@google/genai";

export const transcribeAudio = async (
  audioBase64: string,
  mimeType: string
): Promise<{ result: string; tokens: { input: number; output: number } }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Listen to the attached audio episode.
    Your task is to transcribe it into a Standard Screenplay Format.
    1. Identify distinct speakers and format their dialogue correctly (CHARACTER NAME centered, Dialogue below).
    2. Infer Scene Headings (e.g., INT. PODCAST STUDIO - DAY) if the audio suggests a location change, otherwise use a generic heading.
    3. Include parentheticals for tone if obvious (e.g., (laughing), (whispering)).
    4. Return ONLY the formatted script text. Do not include markdown fencing.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: audioBase64,
            },
          },
        ],
      },
    ],
  });

  return {
    result: response.text || '',
    tokens: {
      input: response.usageMetadata?.promptTokenCount || 0,
      output: response.usageMetadata?.candidatesTokenCount || 0,
    },
  };
};