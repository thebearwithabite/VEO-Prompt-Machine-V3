/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
declare const JSZip: any; // Declare JSZip as a global variable, as the CDN-loaded script likely exposes it globally.
import React, {useCallback, useEffect, useRef, useState} from 'react';
import ApiKeyDialog from './components/ApiKeyDialog';
import LoadingIndicator from './components/LoadingIndicator';
import ProjectSetupForm from './components/PromptForm';
import ConfirmDialog from './components/ConfirmDialog';
import StorageInfoDialog from './components/StorageInfoDialog';
import ShotBookDisplay from './components/VideoResult';
import { StopCircleIcon } from './components/icons';
import {
  generateKeyframeImage,
  generateKeyframePromptText,
  generateProjectName,
  generateSceneNames,
  generateScenePlan,
  generateShotList,
  generateVeoJson,
  extractAssetsFromScript,
  refineVeoJson,
} from './services/geminiService';
import {
  generateVeoVideo,
  getVeoTaskDetails,
  extendVeoVideo
} from './services/veoService';
import {generateMasterShotlistHtml} from './services/reportGenerator';
import {
  ApiCallSummary,
  AppState,
  IngredientImage,
  LogEntry,
  LogType,
  ScenePlan,
  Shot,
  ShotBook,
  ShotStatus,
  VeoShot,
  ProjectAsset,
  VeoStatus,
} from './types';
import { metadata } from '@/metadata';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const API_CALL_DELAY_MS = 1200; // To stay under 60 QPM limit
const LOCAL_STORAGE_KEY = 'veoPromptMachineState';
const VEO_API_KEY_STORAGE = 'veoApiKey';
const PROJECT_VERSION = metadata.version || '0.0.0';

// Helper to convert file to base64
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [shotBook, setShotBook] = useState<ShotBook | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [scenePlans, setScenePlans] = useState<ScenePlan[] | null>(null);
  const [veoApiKey, setVeoApiKey] = useState<string>('');
  
  // Dialog States
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [showStorageInfoDialog, setShowStorageInfoDialog] = useState(false);

  // New State for Assets
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [isAnalyzingAssets, setIsAnalyzingAssets] = useState(false);

  // Stop Generation Logic
  const stopGenerationRef = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [lastPrompt, setLastPrompt] = useState<{
    script: string;
    createKeyframes: boolean;
  } | null>(null);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [apiCallSummary, setApiCallSummary] = useState<ApiCallSummary>({
    pro: 0,
    flash: 0,
    image: 0,
    proTokens: {input: 0, output: 0},
    flashTokens: {input: 0, output: 0},
  });

  // Load from Local Storage on Mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem(VEO_API_KEY_STORAGE);
    if (savedApiKey) setVeoApiKey(savedApiKey);

    const savedState = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState);
        setShotBook(parsedState.shotBook);
        setProjectName(parsedState.projectName);
        setLogEntries(parsedState.logEntries || []);
        setApiCallSummary(parsedState.apiCallSummary || {
            pro: 0, flash: 0, image: 0, proTokens: {input: 0, output: 0}, flashTokens: {input: 0, output: 0}
        });
        setScenePlans(parsedState.scenePlans || null);
        setAssets(parsedState.assets || []);
        
        if (parsedState.shotBook && parsedState.shotBook.length > 0) {
          setAppState(AppState.SUCCESS);
        }
      } catch (e) {
        console.error('Failed to load state:', e);
      }
    }
  }, []);

  // Save to Local Storage
  useEffect(() => {
    if (veoApiKey) {
        localStorage.setItem(VEO_API_KEY_STORAGE, veoApiKey);
    }

    if (appState === AppState.SUCCESS || assets.length > 0) {
      try {
        // Create a lightweight version of the shotbook without heavy images for auto-save
        const lightweightShotBook = shotBook?.map(shot => ({
            ...shot,
            keyframeImage: undefined // Don't autosave heavy images to prevent quota exceeded
        }));
        
        // Also strip images from assets for auto-save
        const lightweightAssets = assets.map(asset => ({
            ...asset,
            image: undefined
        }));

        const stateToSave = {
          shotBook: lightweightShotBook,
          projectName,
          logEntries,
          apiCallSummary,
          scenePlans,
          assets: lightweightAssets
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateToSave));
      } catch (e) {
        console.error('Failed to save state to localStorage:', e);
        // If quota exceeded, we might want to clear old data or notify user
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
             // Optional: Try to clear and save only essential data
             localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
      }
    }
  }, [shotBook, appState, projectName, logEntries, apiCallSummary, scenePlans, assets, veoApiKey]);

  // POLL FOR VEO TASK STATUS
  useEffect(() => {
    if (!veoApiKey || !shotBook) return;

    // Check if any shots are currently generating
    const activeShots = shotBook.filter(s => s.veoStatus === VeoStatus.GENERATING || s.veoStatus === VeoStatus.QUEUED);
    if (activeShots.length === 0) return;

    const pollInterval = setInterval(async () => {
        let updated = false;
        const newShotBook = await Promise.all(shotBook.map(async (shot) => {
             // Only check shots that are actively generating and have a Task ID
             if ((shot.veoStatus === VeoStatus.GENERATING || shot.veoStatus === VeoStatus.QUEUED) && shot.veoTaskId) {
                 try {
                     const info = await getVeoTaskDetails(veoApiKey, shot.veoTaskId);
                     // successFlag: 0=Generating, 1=Success, 2=Failed, 3=Generation Failed
                     let newStatus: VeoStatus = shot.veoStatus;
                     let newUrl = shot.veoVideoUrl;
                     let error = shot.veoError;

                     if (info.data.successFlag === 1) {
                         newStatus = VeoStatus.COMPLETED;
                         newUrl = info.data.response?.resultUrls?.[0];
                         addLogEntry(`Video ready for ${shot.id}`, LogType.SUCCESS);
                     } else if (info.data.successFlag === 2 || info.data.successFlag === 3) {
                         newStatus = VeoStatus.FAILED;
                         error = info.data.errorMessage || "Veo Generation failed";
                         addLogEntry(`Video failed for ${shot.id}: ${error}`, LogType.ERROR);
                     }

                     if (newStatus !== shot.veoStatus) {
                         updated = true;
                         return { ...shot, veoStatus: newStatus, veoVideoUrl: newUrl, veoError: error };
                     }
                 } catch (e) {
                     console.warn(`Polling error for ${shot.id}`, e);
                 }
             }
             return shot;
        }));

        if (updated) {
            setShotBook(newShotBook as ShotBook);
        }

    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [shotBook, veoApiKey]);


  const addLogEntry = (message: string, type: LogType = LogType.INFO) => {
    setLogEntries((prev) => [
      ...prev,
      {timestamp: new Date().toLocaleTimeString(), message, type},
    ]);
  };

  const updateApiSummary = (tokens: {input: number; output: number}, model: 'pro' | 'flash' | 'image') => {
    setApiCallSummary((prev) => ({
      ...prev,
      [model]: prev[model] + 1,
      proTokens: model === 'pro' ? { input: prev.proTokens.input + tokens.input, output: prev.proTokens.output + tokens.output } : prev.proTokens,
      flashTokens: model === 'flash' ? { input: prev.flashTokens.input + tokens.input, output: prev.flashTokens.output + tokens.output } : prev.flashTokens,
    }));
  };

  // ASSET MANAGEMENT
  const handleAnalyzeScriptForAssets = async (script: string) => {
     setIsAnalyzingAssets(true);
     addLogEntry("Analyzing script for visual assets (Characters, Locations, Props)...", LogType.INFO);
     try {
         const { result, tokens } = await extractAssetsFromScript(script);
         updateApiSummary(tokens, 'pro');
         
         // Merge with existing assets (prevent duplicates based on name)
         setAssets(prev => {
             const existingNames = new Set(prev.map(a => a.name.toLowerCase()));
             const newAssets = result.filter(a => !existingNames.has(a.name.toLowerCase()));
             return [...prev, ...newAssets];
         });
         addLogEntry(`Found ${result.length} potential assets.`, LogType.SUCCESS);
     } catch (e) {
         addLogEntry("Failed to extract assets.", LogType.ERROR);
     } finally {
         setIsAnalyzingAssets(false);
     }
  };

  const handleAddAsset = (asset: ProjectAsset) => {
      setAssets(prev => [...prev, asset]);
      addLogEntry(`Added asset: ${asset.name}`, LogType.INFO);
  };

  const handleRemoveAsset = (id: string) => {
      setAssets(prev => prev.filter(a => a.id !== id));
  };

  const handleUpdateAssetImage = async (id: string, file: File) => {
      try {
          const base64 = await fileToBase64(file);
          const mimeType = file.type;
          setAssets(prev => prev.map(a => 
              a.id === id ? { ...a, image: { base64, mimeType } } : a
          ));
          addLogEntry("Updated asset image.", LogType.SUCCESS);
      } catch (e) {
          addLogEntry("Failed to process image.", LogType.ERROR);
      }
  };


  // GENERATION LOGIC
  const handleGenerate = async (scriptInput: string, createKeyframes: boolean) => {
    if (!process.env.API_KEY && !showApiKeyDialog) {
      setShowApiKeyDialog(true);
      return;
    }
    
    stopGenerationRef.current = false;
    setIsProcessing(true);
    setAppState(AppState.LOADING);
    setErrorMessage(null);
    setLogEntries([]);
    setShotBook([]);
    setApiCallSummary({pro: 0, flash: 0, image: 0, proTokens: {input: 0, output: 0}, flashTokens: {input: 0, output: 0}});
    setLastPrompt({script: scriptInput, createKeyframes});

    try {
      addLogEntry('Starting generation process...', LogType.INFO);

      // 1. Project Name
      addLogEntry('Generating project name...', LogType.STEP);
      const nameData = await generateProjectName(scriptInput);
      setProjectName(nameData.result);
      updateApiSummary(nameData.tokens, 'flash');
      addLogEntry(`Project Name: ${nameData.result}`, LogType.SUCCESS);

      if (stopGenerationRef.current) throw new Error("Generation stopped by user.");

      // 2. Generate Shot List
      addLogEntry('Breaking down script into shot list...', LogType.STEP);
      const shotListData = await generateShotList(scriptInput);
      const rawShots = shotListData.result;
      updateApiSummary(shotListData.tokens, 'pro');
      addLogEntry(`Generated ${rawShots.length} shots.`, LogType.SUCCESS);

      if (stopGenerationRef.current) throw new Error("Generation stopped by user.");
      
      // Initialize ShotBook
      const initialShots: Shot[] = rawShots.map((s: any) => ({
        id: s.id,
        status: ShotStatus.PENDING_JSON,
        pitch: s.pitch,
        selectedAssetIds: [], // Will be filled below
      }));
      setShotBook(initialShots);

      // 3. Generate Scene Names
      addLogEntry('Grouping shots and naming scenes...', LogType.STEP);
      const sceneNamesData = await generateSceneNames(rawShots, scriptInput);
      const sceneNameMap = sceneNamesData.result.names;
      updateApiSummary(sceneNamesData.tokens, 'flash');

      // Update shots with scene names
      const shotsWithScenes = initialShots.map(shot => {
         // get prefix from shot id (e.g. ep1_scene1)
         const lastUnderscore = shot.id.lastIndexOf('_');
         const sceneId = lastUnderscore !== -1 ? shot.id.substring(0, lastUnderscore) : shot.id;
         return { ...shot, sceneName: sceneNameMap.get(sceneId) || sceneId };
      });
      setShotBook(shotsWithScenes);

      // 4. Generate Scene Plans (One per scene)
      addLogEntry('Generating Scene Plans for continuity...', LogType.STEP);
      // Group by scene
      const sceneGroups = new Map<string, Shot[]>();
      shotsWithScenes.forEach(shot => {
          const lastUnderscore = shot.id.lastIndexOf('_');
          const sceneId = lastUnderscore !== -1 ? shot.id.substring(0, lastUnderscore) : shot.id;
          if (!sceneGroups.has(sceneId)) sceneGroups.set(sceneId, []);
          sceneGroups.get(sceneId)?.push(shot);
      });

      const plans: ScenePlan[] = [];
      for (const [sceneId, shots] of sceneGroups) {
          if (stopGenerationRef.current) throw new Error("Generation stopped by user.");
          await delay(API_CALL_DELAY_MS);
          const pitches = shots.map(s => `${s.id}: ${s.pitch}`).join('\n');
          try {
              const planData = await generateScenePlan(sceneId, pitches, scriptInput);
              plans.push(planData.result);
              updateApiSummary(planData.tokens, 'pro');
              addLogEntry(`Plan generated for scene: ${sceneId}`, LogType.INFO);
          } catch (e) {
              console.error(`Failed to generate plan for ${sceneId}`, e);
          }
      }
      setScenePlans(plans);

      // 5. Generate VEO JSON and Keyframes (Iterative)
      const finalShots = [...shotsWithScenes];
      
      for (let i = 0; i < finalShots.length; i++) {
        if (stopGenerationRef.current) break;
        
        const shot = finalShots[i];
        
        // Match Assets Logic
        const matchedAssetIds: string[] = [];
        // A simple keyword matching strategy
        assets.forEach(asset => {
            const matchesName = shot.pitch.toLowerCase().includes(asset.name.toLowerCase());
            // You could add description matching here too
            if (matchesName) matchedAssetIds.push(asset.id);
        });
        // Also check against scene name for locations
        if (shot.sceneName) {
            assets.filter(a => a.type === 'location').forEach(loc => {
                if (shot.sceneName?.toLowerCase().includes(loc.name.toLowerCase())) {
                    if (!matchedAssetIds.includes(loc.id)) matchedAssetIds.push(loc.id);
                }
            });
        }
        finalShots[i].selectedAssetIds = matchedAssetIds;

        // --- Generate VEO JSON ---
        setShotBook((prev) =>
          prev ? prev.map((s, idx) => idx === i ? { ...s, status: ShotStatus.GENERATING_JSON } : s) : null
        );
        
        // Find relevant Scene Plan
        const lastUnderscore = shot.id.lastIndexOf('_');
        const sceneId = lastUnderscore !== -1 ? shot.id.substring(0, lastUnderscore) : shot.id;
        const relevantPlan = plans.find(p => p.scene_id === sceneId) || null;

        await delay(API_CALL_DELAY_MS);
        try {
          const jsonData = await generateVeoJson(shot.pitch, shot.id, scriptInput, relevantPlan);
          finalShots[i].veoJson = jsonData.result;
          finalShots[i].status = ShotStatus.PENDING_KEYFRAME_PROMPT;
          updateApiSummary(jsonData.tokens, 'pro');
          
          setShotBook((prev) =>
             prev ? prev.map((s, idx) => idx === i ? { ...s, veoJson: jsonData.result, status: ShotStatus.PENDING_KEYFRAME_PROMPT } : s) : null
          );

          // Update asset matching based on VEO JSON specific fields if available
          if (jsonData.result.veo_shot.character.name && jsonData.result.veo_shot.character.name !== "N/A") {
             const charName = jsonData.result.veo_shot.character.name;
             const charAsset = assets.find(a => a.type === 'character' && (a.name.toLowerCase().includes(charName.toLowerCase()) || charName.toLowerCase().includes(a.name.toLowerCase())));
             if (charAsset && !finalShots[i].selectedAssetIds.includes(charAsset.id)) {
                 finalShots[i].selectedAssetIds.push(charAsset.id);
             }
          }
          // Prop matching
          assets.filter(a => a.type === 'prop').forEach(prop => {
             // Check context or behavior safely with optional chaining or default empty string
             const context = (jsonData.result.veo_shot.scene.context || '').toLowerCase();
             const behavior = (jsonData.result.veo_shot.character.behavior || '').toLowerCase();
             if (context.includes(prop.name.toLowerCase()) || behavior.includes(prop.name.toLowerCase())) {
                 if (!finalShots[i].selectedAssetIds.includes(prop.id)) finalShots[i].selectedAssetIds.push(prop.id);
             }
          });
           // Style matching
          assets.filter(a => a.type === 'style').forEach(style => {
             // Check visual style safely
             const visualStyle = (jsonData.result.veo_shot.scene.visual_style || '').toLowerCase();
             if (visualStyle.includes(style.name.toLowerCase())) {
                 if (!finalShots[i].selectedAssetIds.includes(style.id)) finalShots[i].selectedAssetIds.push(style.id);
             }
          });

        } catch (e) {
          console.error(`Error generating JSON for ${shot.id}`, e);
          finalShots[i].status = ShotStatus.GENERATION_FAILED;
           setShotBook((prev) =>
             prev ? prev.map((s, idx) => idx === i ? { ...s, status: ShotStatus.GENERATION_FAILED } : s) : null
          );
          continue;
        }

        // --- Generate Keyframe Prompt ---
        if (createKeyframes) {
             setShotBook((prev) =>
                prev ? prev.map((s, idx) => idx === i ? { ...s, status: ShotStatus.GENERATING_KEYFRAME_PROMPT } : s) : null
             );
             await delay(API_CALL_DELAY_MS);
             try {
                 const promptData = await generateKeyframePromptText(finalShots[i].veoJson!.veo_shot);
                 finalShots[i].keyframePromptText = promptData.result;
                 updateApiSummary(promptData.tokens, 'pro');
                 
                  setShotBook((prev) =>
                    prev ? prev.map((s, idx) => idx === i ? { ...s, keyframePromptText: promptData.result, status: ShotStatus.GENERATING_IMAGE } : s) : null
                  );

                 // --- Generate Image ---
                 await delay(API_CALL_DELAY_MS);
                 
                 // Collect asset images
                 const ingredientImages: IngredientImage[] = [];
                 finalShots[i].selectedAssetIds.forEach(id => {
                     const asset = assets.find(a => a.id === id);
                     if (asset && asset.image) ingredientImages.push(asset.image);
                 });

                 // Get aspect ratio from JSON or default to 16:9
                 const aspectRatio = finalShots[i].veoJson?.veo_shot.scene.aspect_ratio || "16:9";

                 const imageData = await generateKeyframeImage(finalShots[i].keyframePromptText!, ingredientImages, aspectRatio);
                 finalShots[i].keyframeImage = imageData.result;
                 finalShots[i].status = ShotStatus.NEEDS_REVIEW;
                 updateApiSummary({input: 0, output: 0}, 'image');
                 
                 setShotBook((prev) =>
                    prev ? prev.map((s, idx) => idx === i ? { ...s, keyframeImage: imageData.result, status: ShotStatus.NEEDS_REVIEW } : s) : null
                 );

             } catch (e) {
                 console.error(`Error generating image for ${shot.id}`, e);
                 finalShots[i].status = ShotStatus.GENERATION_FAILED;
                 finalShots[i].errorMessage = (e as Error).message;
                  setShotBook((prev) =>
                    prev ? prev.map((s, idx) => idx === i ? { ...s, status: ShotStatus.GENERATION_FAILED, errorMessage: (e as Error).message } : s) : null
                  );
             }
        } else {
             finalShots[i].status = ShotStatus.NEEDS_KEYFRAME_GENERATION;
             setShotBook((prev) =>
                prev ? prev.map((s, idx) => idx === i ? { ...s, status: ShotStatus.NEEDS_KEYFRAME_GENERATION } : s) : null
             );
        }
      }

      addLogEntry('Generation process completed!', LogType.SUCCESS);
      setAppState(AppState.SUCCESS);

    } catch (e) {
      console.error('Generation Error:', e);
      setErrorMessage((e as Error).message || 'An unexpected error occurred.');
      setAppState(AppState.ERROR);
      addLogEntry(`Error: ${(e as Error).message}`, LogType.ERROR);
    } finally {
        setIsProcessing(false);
        stopGenerationRef.current = false;
    }
  };

  const handleUpdateShot = (updatedShot: Shot) => {
    setShotBook((prev) =>
      prev ? prev.map((s) => (s.id === updatedShot.id ? updatedShot : s)) : null,
    );
  };
  
  const handleToggleAssetForShot = (shotId: string, assetId: string) => {
      setShotBook(prev => {
          if (!prev) return null;
          return prev.map(s => {
              if (s.id === shotId) {
                  const currentIds = s.selectedAssetIds || [];
                  const newIds = currentIds.includes(assetId) 
                     ? currentIds.filter(id => id !== assetId)
                     : [...currentIds, assetId];
                  return { ...s, selectedAssetIds: newIds };
              }
              return s;
          });
      });
  };

  const handleGenerateSpecificKeyframe = async (shotId: string) => {
      // Find the shot
      const shotIndex = shotBook?.findIndex(s => s.id === shotId) ?? -1;
      if (shotIndex === -1 || !shotBook) return;
      const shot = shotBook[shotIndex];

      // Update UI state
      const updateShotStatus = (status: ShotStatus, extra?: Partial<Shot>) => {
           setShotBook(prev => prev ? prev.map((s, i) => i === shotIndex ? { ...s, status, ...extra } : s) : null);
      };

      try {
          // If no prompt text yet, generate it
          let promptText = shot.keyframePromptText;
          if (!promptText && shot.veoJson) {
              updateShotStatus(ShotStatus.GENERATING_KEYFRAME_PROMPT);
              const promptData = await generateKeyframePromptText(shot.veoJson.veo_shot);
              promptText = promptData.result;
              updateApiSummary(promptData.tokens, 'pro');
          }

          if (promptText) {
             updateShotStatus(ShotStatus.GENERATING_IMAGE, { keyframePromptText: promptText });
             
             // Collect assets
             const ingredientImages: IngredientImage[] = [];
             (shot.selectedAssetIds || []).forEach(id => {
                 const asset = assets.find(a => a.id === id);
                 if (asset && asset.image) ingredientImages.push(asset.image);
             });

             const aspectRatio = shot.veoJson?.veo_shot.scene.aspect_ratio || "16:9";

             const imageData = await generateKeyframeImage(promptText, ingredientImages, aspectRatio);
             updateApiSummary({input: 0, output: 0}, 'image');
             updateShotStatus(ShotStatus.NEEDS_REVIEW, { keyframeImage: imageData.result, errorMessage: undefined });
             addLogEntry(`Regenerated keyframe for ${shotId}`, LogType.SUCCESS);
          } else {
              throw new Error("Missing JSON or Prompt Text");
          }

      } catch (e) {
          updateShotStatus(ShotStatus.GENERATION_FAILED, { errorMessage: (e as Error).message });
          addLogEntry(`Failed to regenerate keyframe for ${shotId}`, LogType.ERROR);
      }
  };

  const handleRefineShot = async (shotId: string, feedback: string) => {
      const shotIndex = shotBook?.findIndex(s => s.id === shotId) ?? -1;
      if (shotIndex === -1 || !shotBook) return;
      const shot = shotBook[shotIndex];

      if (!shot.veoJson) {
          alert("Cannot refine a shot without existing JSON.");
          return;
      }
      
      addLogEntry(`Refining ${shotId} with Director's feedback...`, LogType.INFO);

      // Update status
      setShotBook(prev => prev ? prev.map((s, i) => i === shotIndex ? { ...s, status: ShotStatus.GENERATING_JSON } : s) : null);

      try {
          // 1. Refine JSON
          const refinedData = await refineVeoJson(shot.veoJson, feedback);
          updateApiSummary(refinedData.tokens, 'pro');
          const newJson = refinedData.result;

          setShotBook(prev => prev ? prev.map((s, i) => i === shotIndex ? { ...s, veoJson: newJson, status: ShotStatus.PENDING_KEYFRAME_PROMPT } : s) : null);

          // 2. Regenerate Prompt
          const promptData = await generateKeyframePromptText(newJson.veo_shot);
          updateApiSummary(promptData.tokens, 'pro');
          const newPrompt = promptData.result;

          setShotBook(prev => prev ? prev.map((s, i) => i === shotIndex ? { ...s, keyframePromptText: newPrompt, status: ShotStatus.GENERATING_IMAGE } : s) : null);

          // 3. Regenerate Image
          const ingredientImages: IngredientImage[] = [];
             (shot.selectedAssetIds || []).forEach(id => {
                 const asset = assets.find(a => a.id === id);
                 if (asset && asset.image) ingredientImages.push(asset.image);
          });
          const aspectRatio = newJson.veo_shot.scene.aspect_ratio || "16:9";
          const imageData = await generateKeyframeImage(newPrompt, ingredientImages, aspectRatio);
          updateApiSummary({input: 0, output: 0}, 'image');

          setShotBook(prev => prev ? prev.map((s, i) => i === shotIndex ? { ...s, keyframeImage: imageData.result, status: ShotStatus.NEEDS_REVIEW, errorMessage: undefined } : s) : null);
          addLogEntry(`Refinement complete for ${shotId}`, LogType.SUCCESS);

      } catch (e) {
          console.error("Refinement failed", e);
          setShotBook(prev => prev ? prev.map((s, i) => i === shotIndex ? { ...s, status: ShotStatus.GENERATION_FAILED, errorMessage: "Refinement Failed" } : s) : null);
          addLogEntry(`Refinement failed for ${shotId}`, LogType.ERROR);
      }
  };

  // VEO API HANDLERS
  const handleGenerateVeoVideo = async (shotId: string) => {
      if (!veoApiKey) {
          alert("Please enter your Veo API Key in the settings.");
          return;
      }

      const shotIndex = shotBook?.findIndex(s => s.id === shotId) ?? -1;
      if (shotIndex === -1 || !shotBook) return;
      const shot = shotBook[shotIndex];

      if (!shot.keyframePromptText) {
          alert("Keyframe prompt is missing.");
          return;
      }

      // Update Status
      setShotBook(prev => prev ? prev.map((s, i) => i === shotIndex ? { ...s, veoStatus: VeoStatus.QUEUED } : s) : null);
      addLogEntry(`Submitting video generation task for ${shotId}...`, LogType.INFO);

      try {
          const response = await generateVeoVideo(veoApiKey, {
              prompt: shot.keyframePromptText,
              model: 'veo3_fast', // Using fast model for preview speed
              aspectRatio: shot.veoJson?.veo_shot.scene.aspect_ratio || '16:9'
          });

          setShotBook(prev => prev ? prev.map((s, i) => i === shotIndex ? { ...s, veoStatus: VeoStatus.GENERATING, veoTaskId: response.data.taskId } : s) : null);
          addLogEntry(`Task submitted for ${shotId} (ID: ${response.data.taskId})`, LogType.SUCCESS);
      } catch (e) {
          console.error("Veo Generate Failed", e);
          setShotBook(prev => prev ? prev.map((s, i) => i === shotIndex ? { ...s, veoStatus: VeoStatus.FAILED, veoError: (e as Error).message } : s) : null);
          addLogEntry(`Failed to submit video task for ${shotId}`, LogType.ERROR);
      }
  };

  const handleExtendVeoVideo = async (originalShotId: string, prompt: string) => {
      if (!veoApiKey) { alert("Please set Veo API Key"); return; }
      if (!shotBook) return;

      const originalShotIndex = shotBook.findIndex(s => s.id === originalShotId);
      if (originalShotIndex === -1) return;
      const originalShot = shotBook[originalShotIndex];

      if (!originalShot.veoTaskId) {
          alert("Cannot extend a shot that hasn't been generated yet.");
          return;
      }
      
      const newShotId = `${originalShot.id}_ext_${Date.now().toString().slice(-4)}`;
      addLogEntry(`Creating extension shot: ${newShotId}...`, LogType.INFO);

      // Create new shot object
      const newShot: Shot = {
          id: newShotId,
          status: ShotStatus.NEEDS_REVIEW, // Skip Gemini image generation
          pitch: `Extension: ${prompt}`,
          sceneName: originalShot.sceneName,
          selectedAssetIds: originalShot.selectedAssetIds,
          keyframePromptText: prompt, // Use the extend prompt as the text
          veoStatus: VeoStatus.QUEUED,
          // Create a dummy JSON for display
          veoJson: { 
              ...originalShot.veoJson!, 
              unit_type: 'extend', 
              directorNotes: prompt,
              veo_shot: { ...originalShot.veoJson!.veo_shot, shot_id: newShotId }
          }
      };

      // Insert new shot after original
      const newShotBook = [...shotBook];
      newShotBook.splice(originalShotIndex + 1, 0, newShot);
      setShotBook(newShotBook);

      try {
          const response = await extendVeoVideo(veoApiKey, {
              taskId: originalShot.veoTaskId,
              prompt: prompt
          });

          setShotBook(prev => prev ? prev.map(s => {
              if (s.id === newShotId) {
                  return { ...s, veoStatus: VeoStatus.GENERATING, veoTaskId: response.data.taskId };
              }
              return s;
          }) : null);
          addLogEntry(`Extension task started (ID: ${response.data.taskId})`, LogType.SUCCESS);

      } catch (e) {
          console.error("Veo Extend Failed", e);
          setShotBook(prev => prev ? prev.map(s => {
              if (s.id === newShotId) {
                  return { ...s, veoStatus: VeoStatus.FAILED, veoError: (e as Error).message };
              }
              return s;
          }) : null);
          addLogEntry(`Extension failed: ${(e as Error).message}`, LogType.ERROR);
      }
  };


  // EXPORT HANDLERS
  const handleLoadProject = (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);
      // Validate or sanitize if needed
      if (parsed.shotBook) setShotBook(parsed.shotBook);
      if (parsed.projectName) setProjectName(parsed.projectName);
      if (parsed.logEntries) setLogEntries(parsed.logEntries);
      if (parsed.apiCallSummary) setApiCallSummary(parsed.apiCallSummary);
      if (parsed.scenePlans) setScenePlans(parsed.scenePlans);
      if (parsed.assets) setAssets(parsed.assets);
      
      setAppState(AppState.SUCCESS);
      addLogEntry('Project loaded successfully.', LogType.SUCCESS);
    } catch (e) {
      alert('Failed to load project file. It may be corrupted.');
    }
  };

  const handleSaveProject = () => {
     // Include everything in the save file (including heavy images)
     const stateToSave = {
          shotBook,
          projectName,
          logEntries,
          apiCallSummary,
          scenePlans,
          assets
     };
     const blob = new Blob([JSON.stringify(stateToSave, null, 2)], {type: 'application/json'});
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `${projectName || 'veo-project'}.json`;
     a.click();
     URL.revokeObjectURL(url);
  };

  const handleExportPackage = async () => {
    if (!JSZip) {
        alert("JSZip library not loaded. Cannot export.");
        return;
    }
    
    addLogEntry("Packaging project for export...", LogType.INFO);
    const zip = new JSZip();
    const root = zip.folder(projectName || "veo-project");
    
    // 1. Assets
    const assetsFolder = root.folder("01_Assets");
    
    // Characters
    const charsFolder = assetsFolder.folder("Characters");
    assets.filter(a => a.type === 'character').forEach(a => {
        if (a.image) {
            charsFolder.file(`${a.name.replace(/\s+/g, '_')}.png`, a.image.base64, {base64: true});
        }
        charsFolder.file(`${a.name.replace(/\s+/g, '_')}_meta.json`, JSON.stringify(a, null, 2));
    });

    // Locations
    const locsFolder = assetsFolder.folder("Locations");
    assets.filter(a => a.type === 'location').forEach(a => {
        if (a.image) {
            locsFolder.file(`${a.name.replace(/\s+/g, '_')}.png`, a.image.base64, {base64: true});
        }
    });

    // Props & Styles
    const propsFolder = assetsFolder.folder("Props_And_Styles");
    assets.filter(a => a.type === 'prop' || a.type === 'style').forEach(a => {
        if (a.image) {
             propsFolder.file(`${a.type}_${a.name.replace(/\s+/g, '_')}.png`, a.image.base64, {base64: true});
        }
    });

    // 2. Script
    if (lastPrompt?.script) {
        root.folder("02_Script").file("source_script.txt", lastPrompt.script);
    }

    // 3. Production (JSONs + Shotlist)
    const prodFolder = root.folder("03_Production");
    prodFolder.file("full_shot_list.json", JSON.stringify(shotBook, null, 2));
    
    shotBook?.forEach((shot, i) => {
        if (shot.veoJson) {
            prodFolder.file(`shot_${String(i+1).padStart(3, '0')}_${shot.id}.json`, JSON.stringify(shot.veoJson, null, 2));
        }
    });

    // Generate Zip
    const content = await zip.generateAsync({type: "blob"});
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName || 'veo-project'}_PACKAGE.zip`;
    a.click();
    URL.revokeObjectURL(url);
    addLogEntry("Export package downloaded.", LogType.SUCCESS);
  };

  const handleExportAllJsons = async () => {
    if (!JSZip || !shotBook) return;
    const zip = new JSZip();
    shotBook.forEach((shot) => {
      if (shot.veoJson) {
        zip.file(`${shot.id}.json`, JSON.stringify(shot.veoJson, null, 2));
      }
    });
    const content = await zip.generateAsync({type: 'blob'});
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName || 'shots'}-jsons.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadKeyframesZip = async () => {
     if (!JSZip || !shotBook) return;
     const zip = new JSZip();
     let count = 0;
     shotBook.forEach((shot) => {
         if (shot.keyframeImage) {
             zip.file(`${shot.id}.png`, shot.keyframeImage, {base64: true});
             count++;
         }
     });

     if (count === 0) {
         alert("No keyframes to download.");
         return;
     }

     const content = await zip.generateAsync({type: 'blob'});
     const url = URL.createObjectURL(content);
     const a = document.createElement('a');
     a.href = url;
     a.download = `${projectName || 'project'}-keyframes.zip`;
     a.click();
     URL.revokeObjectURL(url);
  };
  
  const handleExportHtmlReport = () => {
      if (!shotBook) return;
      const html = generateMasterShotlistHtml(shotBook, projectName || 'Untitled', apiCallSummary, PROJECT_VERSION);
      const blob = new Blob([html], {type: 'text/html'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName || 'report.html'}`;
      a.click();
      URL.revokeObjectURL(url);
  };

  const handleNewProject = () => {
      setShowNewProjectDialog(true);
  };

  const confirmNewProject = () => {
      // Clear state but preserve assets logic if needed (Currently clears everything except API key)
      // Actually, feature request was to KEEP assets.
      setShotBook(null);
      setProjectName(null);
      setLogEntries([]);
      setApiCallSummary({pro: 0, flash: 0, image: 0, proTokens: {input: 0, output: 0}, flashTokens: {input: 0, output: 0}});
      setScenePlans(null);
      setAppState(AppState.IDLE);
      setLastPrompt(null);
      setErrorMessage(null);
      // NOTE: We do NOT clear assets here, allowing persistence across sessions!
      // setAssets([]); 
      
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      setShowNewProjectDialog(false);
  };

  const handleStopGeneration = () => {
      stopGenerationRef.current = true;
      setIsProcessing(false);
      addLogEntry("Stopping generation... finishing current step.", LogType.INFO);
  };

  return (
    <div className="min-h-screen font-sans text-gray-100 bg-[#121212]">
      {/* Loading Overlay */}
      {appState === AppState.LOADING && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
           <LoadingIndicator />
           <div className="absolute bottom-10">
               <button onClick={handleStopGeneration} className="px-6 py-2 bg-red-800 hover:bg-red-700 text-white rounded-lg flex items-center gap-2">
                   <StopCircleIcon className="w-5 h-5" /> Stop
               </button>
           </div>
        </div>
      )}
      
      {/* Dialogs */}
      {showApiKeyDialog && (
        <ApiKeyDialog onContinue={() => {
            setShowApiKeyDialog(false);
            // Trigger logic to open Google's API key selector would go here if not using env
            // For now, this is just a gate.
        }} />
      )}
      
      <ConfirmDialog 
        isOpen={showNewProjectDialog}
        title="Start New Project?"
        message={`Are you sure? This will clear the current script and shot list.\n\nYour **Asset Library** will be preserved.`}
        onConfirm={confirmNewProject}
        onCancel={() => setShowNewProjectDialog(false)}
      />

      <StorageInfoDialog 
         isOpen={showStorageInfoDialog}
         onClose={() => setShowStorageInfoDialog(false)}
      />

      {/* App Layout */}
      <main className="flex flex-col items-center p-4 md:p-8 min-h-screen max-w-[1920px] mx-auto">
        
        {appState === AppState.IDLE && (
           <div className="flex flex-col items-center w-full max-w-4xl animate-in fade-in duration-700">
             <div className="mb-8 text-center">
                 <h1 className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 mb-4 tracking-tight">
                    VEO Prompt Machine
                 </h1>
                 <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                    Transform your scripts into production-ready VEO 3.1 JSON prompts with AI-powered breakdown, keyframing, and smart asset management.
                 </p>
                 <div className="mt-2 text-xs text-gray-600 font-mono">v{PROJECT_VERSION}</div>
             </div>
             
             <ProjectSetupForm 
                onGenerate={handleGenerate}
                isGenerating={false}
                onLoadProject={handleLoadProject}
                assets={assets}
                onAnalyzeScriptForAssets={handleAnalyzeScriptForAssets}
                isAnalyzingAssets={isAnalyzingAssets}
                onAddAsset={handleAddAsset}
                onRemoveAsset={handleRemoveAsset}
                onUpdateAssetImage={handleUpdateAssetImage}
             />
           </div>
        )}

        {appState !== AppState.IDLE && shotBook && (
           <ShotBookDisplay 
              shotBook={shotBook}
              logEntries={logEntries}
              projectName={projectName}
              scenePlans={scenePlans}
              apiCallSummary={apiCallSummary}
              appVersion={PROJECT_VERSION}
              onNewProject={handleNewProject}
              onUpdateShot={handleUpdateShot}
              onGenerateSpecificKeyframe={handleGenerateSpecificKeyframe}
              onRefineShot={handleRefineShot}
              allAssets={assets}
              onToggleAssetForShot={handleToggleAssetForShot}
              // Legacy/Empty
              allIngredientImages={[]}
              onUpdateShotIngredients={() => {}}
              
              onExportAllJsons={handleExportAllJsons}
              onExportHtmlReport={handleExportHtmlReport}
              onSaveProject={handleSaveProject}
              onDownloadKeyframesZip={handleDownloadKeyframesZip}
              onExportPackage={handleExportPackage}
              onShowStorageInfo={() => setShowStorageInfoDialog(true)}
              
              isProcessing={isProcessing}
              onStopGeneration={handleStopGeneration}

              veoApiKey={veoApiKey}
              onSetVeoApiKey={setVeoApiKey}
              onGenerateVideo={handleGenerateVeoVideo}
              onExtendVeoVideo={handleExtendVeoVideo} // Pass the new handler
           />
        )}
        
        {/* Footer */}
        <footer className="mt-auto py-6 text-center text-gray-600 text-sm">
            <p>Powered by Google Gemini 3 Pro & Veo 3.1 • VEO Prompt Machine V3</p>
        </footer>
      </main>
    </div>
  );
};

export default App;