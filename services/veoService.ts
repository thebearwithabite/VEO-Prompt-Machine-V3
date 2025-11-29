/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// Types for Veo API
export interface VeoGenerateRequest {
  prompt: string;
  model: 'veo3' | 'veo3_fast';
  aspectRatio?: '16:9' | '9:16' | 'Auto';
  generationType?: 'TEXT_2_VIDEO' | 'FIRST_AND_LAST_FRAMES_2_VIDEO' | 'REFERENCE_2_VIDEO';
  imageUrls?: string[]; // Note: Requires public URLs, not base64
  seeds?: number;
  watermark?: string;
  enableTranslation?: boolean;
}

export interface VeoExtendRequest {
  taskId: string;
  prompt: string;
  seeds?: number;
  watermark?: string;
  callBackUrl?: string;
}

export interface VeoGenerateResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
  };
}

export interface VeoTaskInfoResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
    successFlag: 0 | 1 | 2 | 3; // 0: Generating, 1: Success, 2: Failed, 3: Generation Failed
    errorMessage?: string;
    response?: {
        resultUrls?: string[];
        resolution?: string;
    }
  }
}

const BASE_URL = 'https://api.kie.ai/api/v1/veo';

/**
 * Generates a video using Veo 3.1
 */
export const generateVeoVideo = async (apiKey: string, params: VeoGenerateRequest): Promise<VeoGenerateResponse> => {
  const response = await fetch(`${BASE_URL}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
        ...params,
        // Defaulting to TEXT_2_VIDEO since we mostly work with base64 images which this API doesn't support directly
        // unless uploaded elsewhere.
        generationType: params.generationType || 'TEXT_2_VIDEO' 
    })
  });

  const data = await response.json();
  
  if (data.code !== 200) {
      throw new Error(`Veo API Error (${data.code}): ${data.msg}`);
  }
  
  return data;
};

/**
 * Extends an existing Veo 3.1 video
 */
export const extendVeoVideo = async (apiKey: string, params: VeoExtendRequest): Promise<VeoGenerateResponse> => {
    const response = await fetch(`${BASE_URL}/extend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(params)
    });
  
    const data = await response.json();
    
    if (data.code !== 200) {
        throw new Error(`Veo Extend Error (${data.code}): ${data.msg}`);
    }
    
    return data;
};

/**
 * Checks the status of a Veo generation task
 */
export const getVeoTaskDetails = async (apiKey: string, taskId: string): Promise<VeoTaskInfoResponse> => {
    const response = await fetch(`${BASE_URL}/record-info?taskId=${taskId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiKey}`
        }
    });

    const data = await response.json();
    return data;
};