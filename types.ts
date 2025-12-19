
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

export enum ShotStatus {
  PENDING_JSON = 'PENDING_JSON',
  GENERATING_JSON = 'GENERATING_JSON',
  PENDING_KEYFRAME_PROMPT = 'PENDING_KEYFRAME_PROMPT',
  GENERATING_KEYFRAME_PROMPT = 'GENERATING_KEYFRAME_PROMPT',
  NEEDS_KEYFRAME_GENERATION = 'NEEDS_KEYFRAME_GENERATION',
  GENERATING_IMAGE = 'GENERATING_IMAGE',
  NEEDS_REVIEW = 'NEEDS_REVIEW',
  APPROVED = 'APPROVED',
  GENERATION_FAILED = 'GENERATION_FAILED',
}

export enum VeoStatus {
  IDLE = 'IDLE',
  QUEUED = 'QUEUED',
  GENERATING = 'GENERATING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum LogType {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  STEP = 'STEP',
}

// Added missing LogEntry interface for director logs
export interface LogEntry {
  timestamp: string;
  message: string;
  type: LogType;
}

// Added pricing constants for estimated cost calculations in reports
export const IMAGEN_COST_PER_IMAGE = 0.03;
export const GEMINI_FLASH_INPUT_COST_PER_MILLION_TOKENS = 0.075;
export const GEMINI_FLASH_OUTPUT_COST_PER_MILLION_TOKENS = 0.30;
export const GEMINI_PRO_INPUT_COST_PER_MILLION_TOKENS = 3.50;
export const GEMINI_PRO_OUTPUT_COST_PER_MILLION_TOKENS = 10.50;

export interface VeoShot {
  shot_id: string;
  scene: {
    context: string;
    visual_style: string;
    lighting: string;
    mood: string;
    aspect_ratio: '16:9' | '9:16';
    duration_s: 4 | 6 | 8;
  };
  character: {
    name: string;
    gender_age: string;
    description_lock: string;
    behavior: string;
    expression: string;
  };
  camera: {
    shot_call: string;
    movement: string;
  };
  audio: {
    dialogue: string;
    delivery: string;
    // Added ambience and sfx to support production-ready specs and reporting
    ambience?: string;
    sfx?: string;
  };
  flags: {
    continuity_lock: boolean;
    do_not: string[];
    anti_artifacts: string[];
    conflicts: string[];
    warnings: string[];
    cv_updates: string[];
  };
}

export interface VeoShotWrapper {
  unit_type: 'shot' | 'extend';
  directorNotes?: string;
  veo_shot: VeoShot;
}

export interface IngredientImage {
  base64: string;
  mimeType: string;
}

export type AssetType = 'character' | 'location' | 'prop' | 'style';

export interface ProjectAsset {
  id: string;
  name: string;
  description: string;
  type: AssetType;
  image: IngredientImage | null;
  // Semantic Sorting & World Graph Metadata
  vault_fingerprint?: string; // Dense semantic string
  visual_anchors?: string[]; // Shared across shots
  semantic_tags?: string[];
  episode_id?: string;
  project_slug?: string;
}

// Added missing ScenePlan interface
export interface ScenePlan {
  id: string;
  name: string;
  description: string;
}

export interface Shot {
  id: string;
  status: ShotStatus;
  pitch: string;
  sceneName?: string;
  veoJson?: VeoShotWrapper;
  keyframePromptText?: string;
  keyframeImage?: string;
  errorMessage?: string;
  selectedAssetIds: string[]; 
  veoTaskId?: string;
  veoStatus?: VeoStatus;
  veoVideoUrl?: string;
  veoError?: string;
  veoReferenceUrl?: string;
  isApproved?: boolean;
  // Added missing property to fix error in VideoResult.tsx on line 69
  veoUseKeyframeAsReference?: boolean;
}

export type ShotBook = Shot[];

export interface ApiCallSummary {
  pro: number;
  flash: number;
  image: number;
  proTokens: { input: number; output: number; };
  flashTokens: { input: number; output: number; };
}
