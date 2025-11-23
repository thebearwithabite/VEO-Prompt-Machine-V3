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
// Add missing import for ShotBookDisplay component
import ShotBookDisplay from './components/VideoResult';
import {
  generateKeyframeImage, // Renamed from generateKeyframe
  generateKeyframePromptText, // New import
  generateProjectName,
  generateSceneNames,
  generateScenePlan,
  generateShotList,
  generateVeoJson,
  extractAssetsFromScript,
} from './services/geminiService';
import {generateMasterShotlistHtml} from './services/reportGenerator';
import {
  ApiCallSummary,
  AppState,
  IngredientImage,
  LogEntry,
  LogType,
  ScenePlan,
  Shot,
  // Add missing import for ShotBook type
  ShotBook,
  ShotStatus,
  VeoShot,
  ProjectAsset,
} from './types';
import { metadata } from '@/metadata'; // Import metadata to get version - CORRECTED PATH

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const API_CALL_DELAY_MS = 1200; // To stay under 60 QPM limit
const LOCAL_STORAGE_KEY = 'veoPromptMachineState';
const PROJECT_VERSION = metadata.version || '0.0.0'; // Read version from metadata

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

  const addLogEntry = useCallback((message: string, type: LogType) => {
    const timestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setLogEntries((prev) => [...prev, {timestamp, message, type}]);
  }, []);

  // Load state from localStorage on initial mount
  useEffect(() => {
    try {
      const savedState = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        setAppState(parsedState.appState || AppState.IDLE);
        setShotBook(parsedState.shotBook || null);
        setErrorMessage(parsedState.errorMessage || null);
        setProjectName(parsedState.projectName || null);
        setScenePlans(parsedState.scenePlans || null);
        setAssets(parsedState.assets || []);
        setLastPrompt(parsedState.lastPrompt || null);
        setLogEntries(parsedState.logEntries || []);
        setApiCallSummary(
          parsedState.apiCallSummary || {
            pro: 0,
            flash: 0,
            image: 0,
            proTokens: {input: 0, output: 0},
            flashTokens: {input: 0, output: 0},
          },
        );
        addLogEntry('Restored previous session from browser storage.', LogType.INFO);
      }
    } catch (error) {
      console.error('Failed to load state from localStorage:', error);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, [addLogEntry]);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    // Save if we have a valid result OR if we have assets in the library.
    // This ensures users don't lose their asset library setup if they refresh before generating.
    const hasUnsavedWork = (appState === AppState.SUCCESS && shotBook) || assets.length > 0;

    if (hasUnsavedWork) {
      try {
        // OPTIMIZATION: Browser LocalStorage has a limit (usually 5MB).
        // Saving base64 images here will crash the app with QuotaExceededError.
        // We must strip the heavy image data from the auto-save state.
        // Users must use "Save Project" to keep images.
        
        const assetsLite = assets.map(a => ({
            ...a,
            image: null // Strip asset image for auto-save
        }));

        const shotBookLite = shotBook?.map(s => ({
            ...s,
            keyframeImage: undefined // Strip keyframe image for auto-save
        }));

        const stateToSave = {
          appState,
          shotBook: shotBookLite,
          errorMessage,
          projectName,
          scenePlans,
          assets: assetsLite,
          lastPrompt,
          logEntries,
          apiCallSummary,
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateToSave));
      } catch (error) {
        // Just in case it still fails, log it but don't crash
        console.warn('Failed to save state to localStorage (Quota Exceeded). Session data not persisted.', error);
      }
    }
  }, [
    appState,
    shotBook,
    errorMessage,
    projectName,
    scenePlans,
    assets,
    lastPrompt,
    logEntries,
    apiCallSummary,
  ]);


  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio) {
        try {
          if (!(await window.aistudio.hasSelectedApiKey())) {
            setShowApiKeyDialog(true);
          }
        } catch (error) {
          console.warn('aistudio.hasSelectedApiKey check failed.', error);
          setShowApiKeyDialog(true);
        }
      }
    };
    checkApiKey();
  }, []);

  // --- Asset Management Handlers ---
  const handleAnalyzeScriptForAssets = async (script: string) => {
    if (!script.trim()) return;
    setIsAnalyzingAssets(true);
    setErrorMessage(null);
    try {
      const {result: newAssets, tokens} = await extractAssetsFromScript(script);
      
      // Merge with existing assets (deduplicate by name fuzzy match if needed, but for now simple concat or replace)
      // We will just append for now, user can delete.
      setAssets(prev => [...prev, ...newAssets]);
      
      setApiCallSummary(prev => ({
        ...prev,
        pro: prev.pro + 1,
        proTokens: {
            input: prev.proTokens.input + tokens.input,
            output: prev.proTokens.output + tokens.output
        }
      }));
    } catch (error) {
       const message = error instanceof Error ? error.message : 'Unknown error analysing assets.';
       setErrorMessage(`Asset Analysis Failed: ${message}`);
    } finally {
      setIsAnalyzingAssets(false);
    }
  };

  const handleAddAsset = (asset: ProjectAsset) => {
    setAssets(prev => [...prev, asset]);
  };

  const handleRemoveAsset = (id: string) => {
    setAssets(prev => prev.filter(a => a.id !== id));
  };

  const handleUpdateAssetImage = async (id: string, file: File) => {
     try {
       const base64 = await fileToBase64(file);
       setAssets(prev => prev.map(a => {
         if (a.id === id) {
           return { ...a, image: { base64, mimeType: file.type } };
         }
         return a;
       }));
     } catch (e) {
       console.error("Failed to process image", e);
     }
  };

  const handleStopGeneration = () => {
      stopGenerationRef.current = true;
  };

  const handleGenerate = useCallback(
    async (
      script: string,
      createKeyframes: boolean,
    ) => {
      if (window.aistudio) {
        try {
          if (!(await window.aistudio.hasSelectedApiKey())) {
            setShowApiKeyDialog(true);
            return;
          }
        } catch (error) {
          console.warn('aistudio.hasSelectedApiKey check failed.', error);
          setShowApiKeyDialog(true);
          return;
        }
      }

      setAppState(AppState.LOADING);
      setErrorMessage(null);
      setShotBook(null);
      setLastPrompt({script, createKeyframes});
      setLogEntries([]); // Clear logs
      setProjectName(null);
      setScenePlans(null); // Clear scene plans
      const summary: ApiCallSummary = {
        pro: 0,
        flash: 0,
        image: 0,
        proTokens: {input: 0, output: 0},
        flashTokens: {input: 0, output: 0},
      };
      setApiCallSummary(summary);
      addLogEntry('Starting new shot book generation...', LogType.INFO);
      addLogEntry(
        `API rate limit management enabled. Adding a small delay between requests.`,
        LogType.INFO,
      );

      // RESET STOP STATE
      stopGenerationRef.current = false;
      setIsProcessing(true);

      try {
        if (stopGenerationRef.current) throw new Error("Generation stopped by user.");

        // Step 0: Generate Project Name
        addLogEntry('Generating a project name...', LogType.STEP);
        const {result: generatedName, tokens: nameTokens} = await generateProjectName(script);
        summary.flash += 1;
        summary.flashTokens.input += nameTokens.input;
        summary.flashTokens.output += nameTokens.output;
        setApiCallSummary({...summary});
        setProjectName(generatedName);
        addLogEntry(
          `Project name set to: "${generatedName}"`,
          LogType.SUCCESS,
        );
        await delay(API_CALL_DELAY_MS);
        
        if (stopGenerationRef.current) throw new Error("Generation stopped by user.");

        // Step 1: Generate the shot list for immediate structural feedback.
        addLogEntry('Analyzing script to create shot list...', LogType.STEP);
        // UPGRADE: Now uses Gemini 3 Pro
        const {result: shotList, tokens: shotListTokens} = await generateShotList(script);
        summary.pro += 1; // Upgraded to Pro
        summary.proTokens.input += shotListTokens.input;
        summary.proTokens.output += shotListTokens.output;
        setApiCallSummary({...summary});
        addLogEntry(
          `Successfully created shot list with ${shotList.length} shots.`,
          LogType.SUCCESS,
        );
        await delay(API_CALL_DELAY_MS);

        if (stopGenerationRef.current) throw new Error("Generation stopped by user.");

        // Step 1.5: Generate descriptive scene names
        addLogEntry('Generating descriptive scene names...', LogType.STEP);
        const {result: {names: sceneNames, sceneCount}, tokens: sceneNameTokens} = await generateSceneNames(
          shotList,
          script,
        );
        summary.flash += sceneCount; // One call per scene (Flash)
        summary.flashTokens.input += sceneNameTokens.input;
        summary.flashTokens.output += sceneNameTokens.output;
        setApiCallSummary({...summary});
        addLogEntry('Scene names generated successfully.', LogType.SUCCESS);

        const getSceneId = (shotId: string) =>
          shotId.substring(0, shotId.lastIndexOf('_'));

        // Step 1.6: Generate a plan for each scene
        addLogEntry('Generating scene plans for runtime...', LogType.STEP);
        const scenes = new Map<string, {id: string; pitch: string}[]>();
        for (const shot of shotList) {
          const sceneId = getSceneId(shot.id);
          if (sceneId) {
            if (!scenes.has(sceneId)) scenes.set(sceneId, []);
            scenes.get(sceneId)!.push(shot);
          }
        }

        const generatedPlans: ScenePlan[] = [];
        for (const [sceneId, shotsInScene] of scenes.entries()) {
          if (stopGenerationRef.current) throw new Error("Generation stopped by user.");
          addLogEntry(`Planning scene: ${sceneId}...`, LogType.INFO);
          const scenePitches = shotsInScene
            .map((s) => `- ${s.pitch}`)
            .join('\n');
          // UPGRADE: Now uses Gemini 3 Pro
          const {result: plan, tokens: planTokens} = await generateScenePlan(sceneId, scenePitches, script);
          summary.pro += 1; // Upgraded to Pro
          summary.proTokens.input += planTokens.input;
          summary.proTokens.output += planTokens.output;
          setApiCallSummary({...summary});
          generatedPlans.push(plan);
          await delay(API_CALL_DELAY_MS);
        }
        setScenePlans(generatedPlans);
        addLogEntry(
          `Successfully generated ${generatedPlans.length} scene plans.`,
          LogType.SUCCESS,
        );

        const initialShotBook: ShotBook = shotList.map((shot) => {
          const sceneId = getSceneId(shot.id);
          return {
            id: shot.id,
            pitch: shot.pitch,
            status: ShotStatus.PENDING_JSON,
            sceneName: sceneNames.get(sceneId) || sceneId,
            selectedAssetIds: [], // Initialize empty
          };
        });

        if (stopGenerationRef.current) throw new Error("Generation stopped by user.");

        setShotBook(initialShotBook);
        setAppState(AppState.SUCCESS); // Show the shot book UI immediately

        // Step 2 & 3: Sequentially process each shot completely (JSON then Keyframe).
        for (const initialShot of initialShotBook) {
          // CHECK FOR STOP SIGNAL
          if (stopGenerationRef.current) {
              addLogEntry("Generation stopped by user.", LogType.INFO);
              break;
          }

          let currentShot: Shot = {...initialShot};
          addLogEntry(`Processing Shot: ${currentShot.id}`, LogType.INFO);

          // Find the scene plan for this shot
          const sceneId = getSceneId(currentShot.id);
          const scenePlanForShot =
            generatedPlans.find((p) => p.scene_id === sceneId) || null;

          // Generate VEO JSON for the current shot
          try {
            setShotBook((current) =>
              current!.map((s) =>
                s.id === currentShot.id
                  ? {...s, status: ShotStatus.GENERATING_JSON}
                  : s,
              ),
            );
            addLogEntry('Generating VEO JSON...', LogType.STEP);
            // UPGRADE: Now uses Gemini 3 Pro
            const {result: veoJson, tokens: veoJsonTokens} = await generateVeoJson(
              currentShot.pitch,
              currentShot.id,
              script,
              scenePlanForShot,
            );
            summary.pro += 1; // Upgraded to Pro
            summary.proTokens.input += veoJsonTokens.input;
            summary.proTokens.output += veoJsonTokens.output;
            setApiCallSummary({...summary});
            addLogEntry('VEO JSON generated successfully.', LogType.SUCCESS);
            
            // SMART ASSET MAPPING
            // Check if character name or scene context matches any assets
            const assignedAssetIds: string[] = [];
            
            assets.forEach(asset => {
                const nameLower = asset.name.toLowerCase();
                const charName = veoJson.veo_shot.character.name.toLowerCase();
                const context = veoJson.veo_shot.scene.context.toLowerCase();
                const behavior = veoJson.veo_shot.character.behavior.toLowerCase();
                const visualStyle = veoJson.veo_shot.scene.visual_style.toLowerCase();
                
                if (asset.type === 'character' && charName.includes(nameLower)) {
                    assignedAssetIds.push(asset.id);
                }
                if (asset.type === 'location' && context.includes(nameLower)) {
                    assignedAssetIds.push(asset.id);
                }
                if (asset.type === 'prop' && (context.includes(nameLower) || behavior.includes(nameLower))) {
                    assignedAssetIds.push(asset.id);
                }
                if (asset.type === 'style' && visualStyle.includes(nameLower)) {
                    assignedAssetIds.push(asset.id);
                }
            });
            
            if (assignedAssetIds.length > 0) {
                 addLogEntry(`Auto-assigned ${assignedAssetIds.length} assets to shot.`, LogType.INFO);
            }

            currentShot = {
              ...currentShot,
              veoJson,
              selectedAssetIds: assignedAssetIds,
              status: ShotStatus.PENDING_KEYFRAME_PROMPT, // Next state is to generate prompt text
            };
            setShotBook((current) =>
              current!.map((s) => (s.id === currentShot.id ? currentShot : s)),
            );
            await delay(API_CALL_DELAY_MS); // Delay after successful JSON call
          } catch (jsonError) {
            console.error(
              `Failed to generate JSON for ${currentShot.id}:`,
              jsonError,
            );
            const jsonErrorMessage =
              jsonError instanceof Error
                ? jsonError.message
                : 'VEO JSON generation failed.';
            addLogEntry(
              `Failed to generate VEO JSON: ${jsonErrorMessage}`,
              LogType.ERROR,
            );
            const failedShot = {
              ...currentShot,
              status: ShotStatus.GENERATION_FAILED,
              errorMessage: jsonErrorMessage,
            };
            setShotBook((current) =>
              current!.map((s) => (s.id === currentShot.id ? failedShot : s)),
            );
            continue; // Skip to the next shot in the loop if JSON fails
          }

          // Check for stop before prompt generation
          if (stopGenerationRef.current) {
              addLogEntry("Generation stopped by user.", LogType.INFO);
              break;
          }

          // Generate Keyframe Prompt Text
          try {
            setShotBook((current) =>
              current!.map((s) =>
                s.id === currentShot.id
                  ? {...s, status: ShotStatus.GENERATING_KEYFRAME_PROMPT}
                  : s,
              ),
            );
            addLogEntry('Refining keyframe prompt text...', LogType.STEP);
            // UPGRADE: Now a real model call to Gemini 3 Pro to enhance the prompt
            const {result: keyframePromptText, tokens: promptTokens} = await generateKeyframePromptText(
              currentShot.veoJson!.veo_shot as VeoShot,
            );
            
            summary.pro += 1; // Upgraded to Pro call for prompt engineering
            summary.proTokens.input += promptTokens.input;
            summary.proTokens.output += promptTokens.output;
            setApiCallSummary({...summary});
            
            currentShot = {
              ...currentShot,
              keyframePromptText,
              status: ShotStatus.NEEDS_KEYFRAME_GENERATION, // Ready for HIL image generation
            };
            setShotBook((current) =>
              current!.map((s) => (s.id === currentShot.id ? currentShot : s)),
            );
            addLogEntry(
              `Keyframe prompt text refined for Shot ${currentShot.id}.`,
              LogType.SUCCESS,
            );
            await delay(API_CALL_DELAY_MS);
          } catch (promptError) {
            console.error(
              `Failed to generate keyframe prompt text for ${currentShot.id}:`,
              promptError,
            );
            const promptErrorMessage =
              promptError instanceof Error
                ? promptError.message
                : 'Keyframe prompt generation failed.';
            addLogEntry(
              `Failed to generate keyframe prompt text: ${promptErrorMessage}`,
              LogType.ERROR,
            );
            const failedShot = {
              ...currentShot,
              status: ShotStatus.GENERATION_FAILED,
              errorMessage: promptErrorMessage,
            };
            setShotBook((current) =>
              current!.map((s) => (s.id === currentShot.id ? failedShot : s)),
            );
            continue; // Skip to the next shot if prompt text generation fails
          }

          // If 'createKeyframes' is true, automatically generate the image
          if (createKeyframes) {
            
            // Check for stop before image generation
            if (stopGenerationRef.current) {
                addLogEntry("Generation stopped by user.", LogType.INFO);
                break;
            }

            // Generate Keyframe Image for the current shot
            try {
              setShotBook((current) =>
                current!.map((s) =>
                  s.id === currentShot.id
                    ? {...s, status: ShotStatus.GENERATING_IMAGE}
                    : s,
                ),
              );
              addLogEntry('Generating keyframe image...', LogType.STEP);

              // RESOLVE ASSET IDs TO IMAGES
              const ingredientImages: IngredientImage[] = (currentShot.selectedAssetIds || [])
                .map(id => assets.find(a => a.id === id)?.image)
                .filter((img): img is IngredientImage => img !== null);

              // Pass aspect ratio from VEO JSON if available
              const aspectRatio = currentShot.veoJson?.veo_shot.scene.aspect_ratio || '16:9';

              const {result: imageBase64} = await generateKeyframeImage(
                currentShot.keyframePromptText || '',
                ingredientImages,
                aspectRatio // Pass the aspect ratio here
              );
              summary.image += 1;
              setApiCallSummary({...summary});

              currentShot = {
                ...currentShot,
                keyframeImage: imageBase64,
                status: ShotStatus.NEEDS_REVIEW,
              };
              setShotBook((current) =>
                current!.map((s) => (s.id === currentShot.id ? currentShot : s)),
              );
              addLogEntry(
                `Keyframe generated successfully for Shot ${currentShot.id}.`,
                LogType.SUCCESS,
              );
              await delay(API_CALL_DELAY_MS);
            } catch (imageError) {
              console.error(
                `Failed to generate image for ${currentShot.id}:`,
                imageError,
              );
              const imageErrorMessage =
                imageError instanceof Error
                  ? imageError.message
                  : 'Image generation failed.';
              addLogEntry(
                `Failed to generate keyframe image: ${imageErrorMessage}`,
                LogType.ERROR,
              );
              const failedShot = {
                ...currentShot,
                status: ShotStatus.GENERATION_FAILED,
                errorMessage: imageErrorMessage,
              };
              setShotBook((current) =>
                current!.map((s) => (s.id === currentShot.id ? failedShot : s)),
              );
            }
          }
        }

        addLogEntry('Processing complete.', LogType.SUCCESS);
      } catch (error) {
        // If user stopped, we don't want to set Error state, just log it.
        if (stopGenerationRef.current) {
             console.log("Generation flow aborted by user.");
             // If we are not yet in SUCCESS state (i.e. during initial setup), 
             // we might want to go back to IDLE or keep what we have.
             // But since appState is SUCCESS before the loop, we are fine.
             // If stopped during initial analysis (before SUCCESS), we go to ERROR or IDLE.
             if (appState !== AppState.SUCCESS) {
                  setErrorMessage("Generation cancelled by user.");
                  setAppState(AppState.IDLE);
             }
        } else {
            console.error('Process failed:', error);
            setErrorMessage(
            error instanceof Error ? error.message : 'An unexpected error occurred.',
            );
            setAppState(AppState.ERROR);
            addLogEntry('Process terminated due to error.', LogType.ERROR);
        }
      } finally {
          setIsProcessing(false);
      }
    },
    [assets, addLogEntry, appState],
  );

  // Handle user manually requesting a specific keyframe regeneration
  const handleGenerateSpecificKeyframe = async (shotId: string) => {
    setShotBook((current) => {
      if (!current) return null;
      return current.map((s) =>
        s.id === shotId ? {...s, status: ShotStatus.GENERATING_IMAGE} : s,
      );
    });

    const shot = shotBook?.find((s) => s.id === shotId);
    if (!shot) return;

    try {
      addLogEntry(`Regenerating keyframe for ${shotId}...`, LogType.STEP);
      
       // RESOLVE ASSET IDs TO IMAGES (Current Shot state)
      const ingredientImages: IngredientImage[] = (shot.selectedAssetIds || [])
        .map(id => assets.find(a => a.id === id)?.image)
        .filter((img): img is IngredientImage => img !== null);

      // Pass aspect ratio from VEO JSON if available
      const aspectRatio = shot.veoJson?.veo_shot.scene.aspect_ratio || '16:9';

      const {result: imageBase64} = await generateKeyframeImage(
        shot.keyframePromptText || shot.pitch, // Fallback to pitch if no prompt text
        ingredientImages,
        aspectRatio
      );
      
      setApiCallSummary((prev) => ({...prev, image: prev.image + 1}));

      setShotBook((current) =>
        current!.map((s) =>
          s.id === shotId
            ? {
                ...s,
                keyframeImage: imageBase64,
                status: ShotStatus.NEEDS_REVIEW,
              }
            : s,
        ),
      );
      addLogEntry(`Keyframe regenerated for ${shotId}.`, LogType.SUCCESS);
    } catch (error) {
      console.error(`Failed to regenerate image for ${shotId}:`, error);
      setShotBook((current) =>
        current!.map((s) =>
          s.id === shotId
            ? {
                ...s,
                status: ShotStatus.GENERATION_FAILED,
                errorMessage: 'Regeneration failed.',
              }
            : s,
        ),
      );
      addLogEntry(`Failed to regenerate keyframe for ${shotId}.`, LogType.ERROR);
    }
  };

  const handleUpdateShot = (updatedShot: Shot) => {
    setShotBook((current) =>
      current ? current.map((s) => (s.id === updatedShot.id ? updatedShot : s)) : null,
    );
  };

  const handleUpdateShotIngredients = (
    shotId: string,
    newImages: IngredientImage[],
  ) => {
    setShotBook((current) =>
      current
        ? current.map((s) =>
            s.id === shotId ? {...s, ingredientImages: newImages} : s,
          )
        : null,
    );
  };
  
  const handleToggleAssetForShot = (shotId: string, assetId: string) => {
      setShotBook(current => {
          if (!current) return null;
          return current.map(s => {
              if (s.id !== shotId) return s;
              
              const currentAssets = s.selectedAssetIds || [];
              const isSelected = currentAssets.includes(assetId);
              
              let newAssets;
              if (isSelected) {
                  newAssets = currentAssets.filter(id => id !== assetId);
              } else {
                  if (currentAssets.length >= 3) {
                       alert("Maximum 3 assets per shot allowed.");
                       return s;
                  }
                  newAssets = [...currentAssets, assetId];
              }
              
              return { ...s, selectedAssetIds: newAssets };
          });
      });
  };

  const handleRequestNewProject = () => {
    setShowNewProjectDialog(true);
  };

  const confirmNewProject = () => {
    stopGenerationRef.current = true; // Force stop any running loop
    setIsProcessing(false);
    
    setAppState(AppState.IDLE);
    setShotBook(null);
    setErrorMessage(null);
    setProjectName(null);
    setScenePlans(null);
    setLastPrompt(null); // Ensure last prompt is cleared
    setLogEntries([]);
    setApiCallSummary({
      pro: 0,
      flash: 0,
      image: 0,
      proTokens: {input: 0, output: 0},
      flashTokens: {input: 0, output: 0},
    });
    
    // Note: Assets are NOT cleared from state, preserving the library.
    
    // Manually update local storage to reflect the cleared state but kept assets
    try {
      // Strip images from asset persistence in LS as well
      const assetsLite = assets.map(a => ({ ...a, image: null }));
      
      const stateToSave = {
        appState: AppState.IDLE,
        shotBook: null,
        errorMessage: null,
        projectName: null,
        scenePlans: null,
        assets: assetsLite, // Preserved but stripped of images
        lastPrompt: null,
        logEntries: [],
        apiCallSummary: {
            pro: 0, flash: 0, image: 0,
            proTokens: {input: 0, output: 0},
            flashTokens: {input: 0, output: 0},
        },
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (error) {
      console.warn('Storage full or broken, clearing storage completely to ensure new project loads correctly.');
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
    
    setShowNewProjectDialog(false);
  };

  const handleLoadProject = (jsonString: string) => {
      try {
          stopGenerationRef.current = true; // Stop any running process
          
          const parsed = JSON.parse(jsonString);
          if (!parsed.shotBook || !Array.isArray(parsed.shotBook)) {
              throw new Error("Invalid project file format.");
          }
          setShotBook(parsed.shotBook);
          setAppState(parsed.appState || AppState.SUCCESS);
          setProjectName(parsed.projectName || "Loaded Project");
          setScenePlans(parsed.scenePlans || null);
          setAssets(parsed.assets || []);
          setLogEntries(parsed.logEntries || []);
          setLastPrompt(parsed.lastPrompt || null);
          if (parsed.apiCallSummary) setApiCallSummary(parsed.apiCallSummary);
          
          addLogEntry("Project loaded successfully.", LogType.SUCCESS);
      } catch (e) {
          console.error("Load error", e);
          alert("Failed to load project file.");
      }
  };

  const handleSaveProject = () => {
      const stateToSave = {
          appState,
          shotBook,
          errorMessage,
          projectName,
          scenePlans,
          assets,
          lastPrompt,
          logEntries,
          apiCallSummary,
          version: PROJECT_VERSION
      };
      const blob = new Blob([JSON.stringify(stateToSave, null, 2)], {type: "application/json"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName || 'veo-project'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  // NEW: Structured Export for External Organizers
  const handleExportPackage = async () => {
    if (!shotBook) return;
    if (typeof JSZip === 'undefined') {
        alert('Export library (JSZip) not loaded. Please check your internet connection and reload.');
        return;
    }
    try {
        const zip = new JSZip();
        const root = zip.folder(projectName || "New_Project");

        // 1. Assets Folder
        const assetsFolder = root.folder("Assets");
        
        // Create type subfolders
        const charFolder = assetsFolder.folder("Characters");
        const locFolder = assetsFolder.folder("Locations");
        const otherFolder = assetsFolder.folder("Other");

        assets.forEach(asset => {
            let targetFolder = otherFolder;
            if (asset.type === 'character') targetFolder = charFolder;
            if (asset.type === 'location') targetFolder = locFolder;

            // Save Image
            if (asset.image) {
                const ext = asset.image.mimeType.split('/')[1] || 'png';
                const safeName = asset.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                targetFolder.file(`${safeName}.${ext}`, asset.image.base64, {base64: true});
                
                // Save Sidecar Metadata (Perfect for AI Organizers)
                const metadata = {
                    name: asset.name,
                    description: asset.description,
                    type: asset.type,
                    veo_context: "VEO Prompt Machine Asset",
                    id: asset.id
                };
                targetFolder.file(`${safeName}.json`, JSON.stringify(metadata, null, 2));
            }
        });

        // 2. Source Script
        if (lastPrompt?.script) {
            root.folder("Source").file("script.txt", lastPrompt.script);
        }

        // 3. Production Data
        const prodFolder = root.folder("Production");
        prodFolder.file("shot_list.json", JSON.stringify(shotBook, null, 2));
        
        // Save individual VEO JSONs
        const promptsFolder = prodFolder.folder("Prompts");
        shotBook.forEach(shot => {
            if (shot.veoJson) {
                promptsFolder.file(`${shot.id}.json`, JSON.stringify(shot.veoJson, null, 2));
            }
        });

        const content = await zip.generateAsync({type: "blob"});
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projectName || 'project'}_organizer_package.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error("Export failed:", e);
        alert("Failed to create export package. See console for details.");
    }
  };

  const handleExportAllJsons = async () => {
    if (!shotBook) return;
    if (typeof JSZip === 'undefined') {
        alert('Export library (JSZip) not loaded. Please check your internet connection and reload.');
        return;
    }
    try {
        const zip = new JSZip();
        const folder = zip.folder("veo_jsons");
        
        shotBook.forEach((shot) => {
            if (shot.veoJson) {
                folder.file(`${shot.id}.json`, JSON.stringify(shot.veoJson, null, 2));
            }
        });
        
        const content = await zip.generateAsync({type: "blob"});
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projectName || 'project'}_veo_jsons.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error("Export JSONs failed:", e);
    }
  };

  const handleExportHtmlReport = () => {
    if (!shotBook) return;
    const html = generateMasterShotlistHtml(
      shotBook,
      projectName || 'Untitled Project',
      apiCallSummary,
      PROJECT_VERSION,
    );
    const blob = new Blob([html], {type: 'text/html'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName || 'project'}_report.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const handleDownloadKeyframesZip = async () => {
      if (!shotBook) return;
      if (typeof JSZip === 'undefined') {
        alert('Export library (JSZip) not loaded. Please check your internet connection and reload.');
        return;
      }
      try {
          const zip = new JSZip();
          const folder = zip.folder("keyframes");
          
          let count = 0;
          shotBook.forEach(shot => {
              if (shot.keyframeImage) {
                  folder.file(`${shot.id}.png`, shot.keyframeImage, {base64: true});
                  count++;
              }
          });
          
          if (count === 0) {
              alert("No keyframes to download.");
              return;
          }

          const content = await zip.generateAsync({type: "blob"});
          const url = URL.createObjectURL(content);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${projectName || 'project'}_keyframes.zip`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
      } catch (e) {
          console.error("Export keyframes failed:", e);
      }
  }


  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-indigo-500/30">
      {showApiKeyDialog && (
        <ApiKeyDialog
          onContinue={async () => {
             if (window.aistudio) {
                 try {
                     await window.aistudio.openSelectKey();
                     setShowApiKeyDialog(false);
                 } catch (e) {
                     console.error("Key selection failed", e);
                 }
             } else {
                 setShowApiKeyDialog(false);
             }
          }}
        />
      )}
      
      <ConfirmDialog 
        isOpen={showNewProjectDialog}
        title="Start New Project?"
        message={`Are you sure you want to start a new project?\n\nThis will clear your current script and shot list.\nHowever, your Asset Library will be preserved so you can reuse characters and locations.`}
        onConfirm={confirmNewProject}
        onCancel={() => setShowNewProjectDialog(false)}
      />

      <StorageInfoDialog 
        isOpen={showStorageInfoDialog}
        onClose={() => setShowStorageInfoDialog(false)}
      />

      {appState === AppState.IDLE && (
        <div className="flex items-center justify-center min-h-screen p-4">
          <ProjectSetupForm
            onGenerate={handleGenerate}
            isGenerating={isProcessing} // Updated check: removed redundant state check that caused type errors
            onLoadProject={handleLoadProject}
            
            // Pass Asset Props
            assets={assets}
            onAnalyzeScriptForAssets={handleAnalyzeScriptForAssets}
            isAnalyzingAssets={isAnalyzingAssets}
            onAddAsset={handleAddAsset}
            onRemoveAsset={handleRemoveAsset}
            onUpdateAssetImage={handleUpdateAssetImage}
          />
        </div>
      )}

      {appState === AppState.LOADING && (
        <div className="flex items-center justify-center min-h-screen">
          <LoadingIndicator />
        </div>
      )}

      {(appState === AppState.SUCCESS || appState === AppState.ERROR) &&
        shotBook && (
          <ShotBookDisplay
            shotBook={shotBook}
            logEntries={logEntries}
            projectName={projectName}
            scenePlans={scenePlans}
            apiCallSummary={apiCallSummary}
            appVersion={PROJECT_VERSION}
            onNewProject={handleRequestNewProject}
            onUpdateShot={handleUpdateShot}
            onGenerateSpecificKeyframe={handleGenerateSpecificKeyframe}
            
            // UPDATED PROPS FOR ASSET MANAGEMENT
            allIngredientImages={assets.filter(a => a.image).map(a => a.image!)} // For backward compatibility display if needed
            onUpdateShotIngredients={handleUpdateShotIngredients} // Deprecated but kept
            
            // New Prop for asset toggling
            allAssets={assets}
            onToggleAssetForShot={handleToggleAssetForShot}

            onExportAllJsons={handleExportAllJsons}
            onExportHtmlReport={handleExportHtmlReport}
            onSaveProject={handleSaveProject}
            onDownloadKeyframesZip={handleDownloadKeyframesZip}
            // New Export for Organizer
            onExportPackage={handleExportPackage}
            onShowStorageInfo={() => setShowStorageInfoDialog(true)}
            
            // New props for Stop Generation
            isProcessing={isProcessing}
            onStopGeneration={handleStopGeneration}
          />
        )}
    </div>
  );
};

export default App;