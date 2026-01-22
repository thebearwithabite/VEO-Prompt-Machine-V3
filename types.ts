
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
export enum AppState {
  IDLE,
  LOADING,
  SUCCESS,
  ERROR,
}

export enum LogType {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  STEP = 'STEP',
}

/** 
 * Added definitions for the VEO production workflow and asset management.
 */

export type AssetType = 'character' | 'location' | 'prop' | 'style';

export interface ProjectAsset {
  id: string;
  name: string;
  description: string;
  type: AssetType;
  image: {
    mimeType: string;
    base64: string;
  } | null;
}

export interface LogEntry {
  timestamp: string;
  type: LogType;
  message: string;
}

export enum ShotStatus {
  IDLE = 'IDLE',
  GENERATING_JSON = 'GENERATING_JSON',
  GENERATING_IMAGE = 'GENERATING_IMAGE',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export enum VeoStatus {
  IDLE = 'IDLE',
  QUEUED = 'QUEUED',
  GENERATING = 'GENERATING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export interface IngredientImage {
  id: string;
  mimeType: string;
  base64: string;
}

export interface Shot {
  id: string;
  sceneName: string;
  pitch: string;
  status: ShotStatus;
  veoStatus: VeoStatus;
  veoVideoUrl?: string;
  keyframeImage?: string; // base64 encoded string
  isApproved: boolean;
  selectedAssetIds: string[];
  veoJson?: any; 
  veoUseKeyframeAsReference?: boolean;
  veoReferenceUrl?: string;
  keyframePromptText?: string;
  directorNotes?: string;
}

export type ShotBook = Shot[];

export interface ApiCallSummary {
  pro: number;
  flash: number;
  image: number;
  proTokens: {
    input: number;
    output: number;
  };
  flashTokens: {
    input: number;
    output: number;
  };
}

export interface ScenePlan {
  id: string;
  name: string;
  description: string;
}

export interface VeoShotWrapper {
  veo_shot: any;
  directorNotes?: string;
}

// Cost constants for AI service usage reporting
export const IMAGEN_COST_PER_IMAGE = 0.04;
export const GEMINI_FLASH_INPUT_COST_PER_MILLION_TOKENS = 0.075;
export const GEMINI_FLASH_OUTPUT_COST_PER_MILLION_TOKENS = 0.30;
export const GEMINI_PRO_INPUT_COST_PER_MILLION_TOKENS = 1.25;
export const GEMINI_PRO_OUTPUT_COST_PER_MILLION_TOKENS = 5.00;

export interface ExtraQuality {
  name: string;
  value: number;
}

export interface Rollout {
  behavior: string;
  score: number;
  reasoning: string;
  extra_qualities: ExtraQuality[];
}

export interface AuditSuite {
  target_model: string;
  timestamp: string;
  total_rollouts: number;
  audit_summary: string;
  rollouts: Rollout[];
}
