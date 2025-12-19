
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// Types for Veo API
export interface VeoGenerateRequest {
  prompt: string;
  model: 'veo3_fast'; 
  aspectRatio?: '16:9' | '9:16' | 'Auto';
  generationType?: 'TEXT_2_VIDEO' | 'FIRST_AND_LAST_FRAMES_2_VIDEO' | 'REFERENCE_2_VIDEO';
  imageUrls?: string[]; 
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
    fallbackFlag?: boolean;
    response?: {
        resultUrls?: string[];
        resolution?: string;
        originUrls?: string[];
    }
  }
}

const BASE_URL = 'https://api.kie.ai/api/v1/veo';

/**
 * Generates a video using Veo 3.1
 */
export const generateVeoVideo = async (apiKey: string, params: VeoGenerateRequest): Promise<VeoGenerateResponse> => {
  console.debug("[VeoAPI] Requesting Generate:", params);
  const response = await fetch(`${BASE_URL}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
        ...params,
        model: 'veo3_fast', 
        generationType: params.generationType || (params.imageUrls && params.imageUrls.length > 0 ? 'REFERENCE_2_VIDEO' : 'TEXT_2_VIDEO') 
    })
  });

  const data = await response.json();
  console.debug("[VeoAPI] Response Generate:", data);
  
  if (data.code !== 200) {
      throw new Error(`Veo API Error (${data.code}): ${data.msg}`);
  }
  
  return data;
};

/**
 * Extends an existing Veo 3.1 video
 */
export const extendVeoVideo = async (apiKey: string, params: VeoExtendRequest): Promise<VeoGenerateResponse> => {
    console.debug("[VeoAPI] Requesting Extend:", params);
    const response = await fetch(`${BASE_URL}/extend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(params)
    });
  
    const data = await response.json();
    console.debug("[VeoAPI] Response Extend:", data);
    
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
    // Do not throw here, let the caller handle non-200 codes (like 422 record null)
    return data as VeoTaskInfoResponse;
};
