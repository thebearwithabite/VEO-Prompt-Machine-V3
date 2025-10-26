/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
declare const JSZip: any; // Declare JSZip as a global variable, as the CDN-loaded script likely exposes it globally.
import React, {useCallback, useEffect, useState} from 'react';
import ApiKeyDialog from './components/ApiKeyDialog';
import LoadingIndicator from './components/LoadingIndicator';
import ProjectSetupForm from './components/PromptForm';
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
} from './types';
import { metadata } from '@/metadata'; // Import metadata to get version - CORRECTED PATH

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const API_CALL_DELAY_MS = 1200; // To stay under 60 QPM limit
const LOCAL_STORAGE_KEY = 'veoPromptMachineState';
const PROJECT_VERSION = metadata.version || '0.0.0'; // Read version from metadata

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [shotBook, setShotBook] = useState<ShotBook | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [scenePlans, setScenePlans] = useState<ScenePlan[] | null>(null);
  const [lastPrompt, setLastPrompt] = useState<{
    script: string;
    images: IngredientImage[];
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
    // We only save when there's a successful result to avoid saving error states
    if (appState === AppState.SUCCESS && shotBook) {
      try {
        const stateToSave = {
          appState,
          shotBook,
          errorMessage,
          projectName,
          scenePlans,
          lastPrompt,
          logEntries,
          apiCallSummary,
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateToSave));
      } catch (error) {
        console.error('Failed to save state to localStorage:', error);
      }
    }
  }, [
    appState,
    shotBook,
    errorMessage,
    projectName,
    scenePlans,
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

  const handleGenerate = useCallback(
    async (
      script: string,
      images: IngredientImage[],
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
      setLastPrompt({script, images, createKeyframes});
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

      try {
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

        // Step 1: Generate the shot list for immediate structural feedback.
        addLogEntry('Analyzing script to create shot list...', LogType.STEP);
        const {result: shotList, tokens: shotListTokens} = await generateShotList(script);
        summary.flash += 1; // Changed from pro to flash
        summary.flashTokens.input += shotListTokens.input; // Changed from proTokens to flashTokens
        summary.flashTokens.output += shotListTokens.output; // Changed from proTokens to flashTokens
        setApiCallSummary({...summary});
        addLogEntry(
          `Successfully created shot list with ${shotList.length} shots.`,
          LogType.SUCCESS,
        );
        await delay(API_CALL_DELAY_MS);

        // Step 1.5: Generate descriptive names for each scene
        addLogEntry('Generating descriptive scene names...', LogType.STEP);
        const {result: {names: sceneNames, sceneCount}, tokens: sceneNameTokens} = await generateSceneNames(
          shotList,
          script,
        );
        summary.flash += sceneCount; // One call per scene
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
          addLogEntry(`Planning scene: ${sceneId}...`, LogType.INFO);
          const scenePitches = shotsInScene
            .map((s) => `- ${s.pitch}`)
            .join('\n');
          const {result: plan, tokens: planTokens} = await generateScenePlan(sceneId, scenePitches, script);
          summary.flash += 1; // Changed from pro to flash
          summary.flashTokens.input += planTokens.input; // Changed from proTokens to flashTokens
          summary.flashTokens.output += planTokens.output; // Changed from proTokens to flashTokens
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
            ingredientImages: images, // Default to global ingredient images
          };
        });

        setShotBook(initialShotBook);
        setAppState(AppState.SUCCESS); // Show the shot book UI immediately

        // Step 2 & 3: Sequentially process each shot completely (JSON then Keyframe).
        for (const initialShot of initialShotBook) {
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
            const {result: veoJson, tokens: veoJsonTokens} = await generateVeoJson(
              currentShot.pitch,
              currentShot.id,
              script,
              scenePlanForShot,
            );
            summary.flash += 1; // Changed from pro to flash
            summary.flashTokens.input += veoJsonTokens.input; // Changed from proTokens to flashTokens
            summary.flashTokens.output += veoJsonTokens.output; // Changed from proTokens to flashTokens
            setApiCallSummary({...summary});
            addLogEntry('VEO JSON generated successfully.', LogType.SUCCESS);
            currentShot = {
              ...currentShot,
              veoJson,
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

          // Generate Keyframe Prompt Text
          try {
            setShotBook((current) =>
              current!.map((s) =>
                s.id === currentShot.id
                  ? {...s, status: ShotStatus.GENERATING_KEYFRAME_PROMPT}
                  : s,
              ),
            );
            addLogEntry('Generating keyframe prompt text...', LogType.STEP);
            // This is a client-side prompt construction, not a model call for tokens
            const {result: keyframePromptText} = await generateKeyframePromptText(
              currentShot.veoJson!.veo_shot as VeoShot,
            );
            // No flash token count incremented here as it's not an API call.
            // summary.flash += 1; // Count this as a flash call for prompt generation
            // setApiCallSummary({...summary});
            currentShot = {
              ...currentShot,
              keyframePromptText,
              status: ShotStatus.NEEDS_KEYFRAME_GENERATION, // Ready for HIL image generation
            };
            setShotBook((current) =>
              current!.map((s) => (s.id === currentShot.id ? currentShot : s)),
            );
            addLogEntry(
              `Keyframe prompt text generated for Shot ${currentShot.id}.`,
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
              const {result: keyframeImage} = await generateKeyframeImage(
                currentShot.keyframePromptText!,
                currentShot.ingredientImages || [],
              );
              summary.image += 1;
              setApiCallSummary({...summary});
              addLogEntry(
                'Keyframe image generated. Ready for review.',
                LogType.SUCCESS,
              );
              const finishedShot = {
                ...currentShot,
                keyframeImage,
                status: ShotStatus.NEEDS_REVIEW,
                errorMessage: undefined,
              };
              setShotBook((current) =>
                current!.map((s) =>
                  s.id === currentShot.id ? finishedShot : s,
                ),
              );
              await delay(API_CALL_DELAY_MS); // Delay after successful keyframe image call
            } catch (keyframeError) {
              console.error(
                `Failed to generate keyframe image for ${currentShot.id}:`,
                keyframeError,
              );
              const keyframeErrorMessage =
                keyframeError instanceof Error
                  ? keyframeError.message
                  : 'Keyframe image generation failed.';
              addLogEntry(
                `Failed to generate keyframe image: ${keyframeErrorMessage}`,
                LogType.ERROR,
              );
              const failedShot = {
                ...currentShot,
                status: ShotStatus.GENERATION_FAILED,
                errorMessage: keyframeErrorMessage,
              };
              setShotBook((current) =>
                current!.map((s) => (s.id === currentShot.id ? failedShot : s)),
              );
            }
          } else {
            addLogEntry(
              `Keyframe image for Shot ${currentShot.id} skipped (HIL mode). Ready for manual generation.`,
              LogType.INFO,
            );
          }
        }
        addLogEntry(
          'Shot book generation complete. Ready for your review.',
          LogType.INFO,
        );
      } catch (error) {
        console.error('Shot list generation failed:', error);
        const errMessage =
          error instanceof Error ? error.message : 'An unknown error occurred.';

        let userFriendlyMessage = `Shot list generation failed: ${errMessage}`;
        addLogEntry(userFriendlyMessage, LogType.ERROR);
        let shouldOpenDialog = false;

        if (typeof errMessage === 'string') {
          if (errMessage.includes('Requested entity was not found.')) {
            userFriendlyMessage =
              'Model not found. This can be caused by an invalid API key or permission issues. Please check your API key.';
            shouldOpenDialog = true;
          } else if (
            errMessage.includes('API_KEY_INVALID') ||
            errMessage.includes('API key not valid') ||
            errMessage.toLowerCase().includes('permission denied')
          ) {
            userFriendlyMessage =
              'Your API key is invalid or lacks permissions. Please select a valid, billing-enabled API key.';
            shouldOpenDialog = true;
          }
        }

        setErrorMessage(userFriendlyMessage);
        setAppState(AppState.ERROR);
        if (shouldOpenDialog) setShowApiKeyDialog(true);
      }
    },
    [addLogEntry],
  );

  const getSafeFileName = (name: string) =>
    name.replace(/[^a-z0-9-_]/gi, '_').toLowerCase();
  
  const downloadFile = (content: string | Blob, fileName: string, mimeType?: string) => {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleGenerateSpecificKeyframe = async (shotId: string) => {
    if (!shotBook) return;

    const shotToGenerate = shotBook.find((s) => s.id === shotId);
    if (!shotToGenerate || !shotToGenerate.keyframePromptText) return;

    addLogEntry(`Generating keyframe image for Shot ${shotToGenerate.id}...`, LogType.STEP);

    setShotBook((currentShotBook) =>
      currentShotBook!.map((s) =>
        s.id === shotId
          ? {...s, status: ShotStatus.GENERATING_IMAGE, errorMessage: undefined}
          : s,
      ),
    );

    try {
      const {result: keyframeImage} = await generateKeyframeImage(
        shotToGenerate.keyframePromptText,
        shotToGenerate.ingredientImages || [],
      );
      setApiCallSummary((prev) => ({...prev, image: prev.image + 1}));
      addLogEntry(`Keyframe image for Shot ${shotToGenerate.id} generated successfully.`, LogType.SUCCESS);
      setShotBook((currentShotBook) =>
        currentShotBook!.map((s) =>
          s.id === shotId
            ? {
                ...s,
                keyframeImage,
                status: ShotStatus.NEEDS_REVIEW,
              }
            : s,
        ),
      );
    } catch (keyframeError) {
      console.error(`Failed to generate keyframe image for ${shotId}:`, keyframeError);
      const keyframeErrorMessage =
        keyframeError instanceof Error
          ? keyframeError.message
          : 'Keyframe image generation failed.';
      addLogEntry(`Failed to generate keyframe image for Shot ${shotId}: ${keyframeErrorMessage}`, LogType.ERROR);
      setShotBook((currentShotBook) =>
        currentShotBook!.map((s) =>
          s.id === shotId
            ? {
                ...s,
                status: ShotStatus.GENERATION_FAILED,
                errorMessage: keyframeErrorMessage,
              }
            : s,
        ),
      );
    }
  };

  const handleRetry = useCallback(() => {
    if (lastPrompt) {
      handleGenerate(
        lastPrompt.script,
        lastPrompt.images,
        lastPrompt.createKeyframes,
      );
    }
  }, [lastPrompt, handleGenerate]);

  const handleApiKeyDialogContinue = async () => {
    setShowApiKeyDialog(false);
    if (window.aistudio) await window.aistudio.openSelectKey();
    if (appState === AppState.ERROR && lastPrompt) handleRetry();
  };

  const handleNewProject = useCallback(() => {
    setAppState(AppState.IDLE);
    setShotBook(null);
    setErrorMessage(null);
    setLastPrompt(null);
    setLogEntries([]);
    setProjectName(null);
    setScenePlans(null);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setApiCallSummary({ // Reset summary on new project
      pro: 0,
      flash: 0,
      image: 0,
      proTokens: { input: 0, output: 0 },
      flashTokens: { input: 0, output: 0 },
    });
  }, []);

  const handleUpdateShot = async (updatedShot: Shot) => {
    setShotBook(
      (prev) =>
        prev?.map((shot) => (shot.id === updatedShot.id ? updatedShot : shot)) ??
        null,
    );
  };

  const handleUpdateShotIngredients = (
    shotId: string,
    newImages: IngredientImage[],
  ) => {
    setShotBook(
      (prev) =>
        prev?.map((shot) => {
          if (shot.id === shotId) {
            return {...shot, ingredientImages: newImages};
          }
          return shot;
        }) ?? null,
    );
  };

  const handleDownloadAllJsons = () => {
    if (!shotBook || !projectName) return;

    const shotsToExport = shotBook.filter((shot) => shot.veoJson);

    if (shotsToExport.length === 0) {
      addLogEntry('Export cancelled: No shots have VEO JSON available.', LogType.ERROR);
      return;
    }

    addLogEntry(`Preparing ${shotsToExport.length} VEO JSON prompts for download...`, LogType.INFO);
    
    const allJsons = shotsToExport.map(shot => shot.veoJson);
    const jsonString = JSON.stringify(allJsons, null, 2);
    const fileName = `${getSafeFileName(projectName)}_veo-prompts.json`;
    
    downloadFile(jsonString, fileName, 'application/json');
    addLogEntry('VEO JSONs download started.', LogType.SUCCESS);
  };

  const handleExportHtmlReport = () => {
    if (!shotBook || !projectName) {
      addLogEntry('HTML Report export failed: Missing shot book or project name.', LogType.ERROR);
      return;
    }
    addLogEntry('Generating Master Shot List HTML report...', LogType.INFO);
    const htmlContent = generateMasterShotlistHtml(shotBook, projectName, apiCallSummary, PROJECT_VERSION);
    const fileName = `${getSafeFileName(projectName)}_master-shot-list.html`;

    downloadFile(htmlContent, fileName, 'text/html');
    addLogEntry('HTML report download started.', LogType.SUCCESS);
  };

  const handleDownloadKeyframesZip = async () => {
    if (!shotBook || !projectName) return;
    addLogEntry('Preparing keyframes for ZIP download...', LogType.INFO);

    // Ensure JSZip is available globally
    if (typeof JSZip === 'undefined') {
      addLogEntry('ZIP library (JSZip) is not loaded. Please check your network or browser settings.', LogType.ERROR);
      console.error('JSZip global variable is not defined.');
      return;
    }

    const zip = new JSZip();
    const projectFolder = zip.folder(getSafeFileName(projectName));

    if (!projectFolder) {
        addLogEntry('Failed to create project folder in zip.', LogType.ERROR);
        return;
    }
    
    let imageCount = 0;
    for (const shot of shotBook) {
        if (shot.keyframeImage) {
            const fileName = `${getSafeFileName(shot.id)}__keyframe.png`;
            projectFolder.file(fileName, shot.keyframeImage, { base64: true });
            imageCount++;
        }
    }

    if (imageCount === 0) {
        addLogEntry('No keyframes available to download.', LogType.ERROR);
        return;
    }

    try {
        const content = await zip.generateAsync({ type: "blob" });
        const zipFileName = `${getSafeFileName(projectName)}_keyframes.zip`;
        downloadFile(content, zipFileName, 'application/zip');
        addLogEntry(`Successfully started download of ${imageCount} keyframes in a ZIP file.`, LogType.SUCCESS);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error.';
        addLogEntry(`Failed to generate ZIP file: ${message}`, LogType.ERROR);
        console.error('Failed to generate zip:', error);
    }
  };

  const handleSaveProject = () => {
    if (!shotBook) {
        addLogEntry('Cannot save project: No shot book data exists.', LogType.ERROR);
        return;
    }
    try {
        const stateToSave = {
          appState: AppState.SUCCESS, // Always restore to success state
          shotBook,
          errorMessage: null,
          projectName,
          scenePlans,
          lastPrompt,
          logEntries,
          apiCallSummary,
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateToSave)); // Save to local storage
        
        // Also offer to download the file directly
        const jsonString = JSON.stringify(stateToSave, null, 2);
        const fileName = `${getSafeFileName(projectName || 'untitled-project')}_session.json`;
        downloadFile(jsonString, fileName, 'application/json');
        addLogEntry('Project session file downloaded and saved to browser storage.', LogType.SUCCESS);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error.';
        addLogEntry(`Failed to save project: ${message}`, LogType.ERROR);
        console.error('Failed to save project state:', error);
    }
  };
  
  const handleLoadProject = (jsonString: string) => {
    try {
        const loadedState = JSON.parse(jsonString);
        // Basic validation
        if (!loadedState.shotBook || !loadedState.projectName) {
            throw new Error("Invalid project file format.");
        }
        setShotBook(loadedState.shotBook);
        setProjectName(loadedState.projectName);
        setScenePlans(loadedState.scenePlans || null);
        setLastPrompt(loadedState.lastPrompt || null);
        setLogEntries(loadedState.logEntries || []);
        setApiCallSummary(loadedState.apiCallSummary || { pro: 0, flash: 0, image: 0, proTokens: { input: 0, output: 0 }, flashTokens: { input: 0, output: 0 } });
        setErrorMessage(null);
        setAppState(AppState.SUCCESS);
        localStorage.setItem(LOCAL_STORAGE_KEY, jsonString); // Also save to local storage on load
        addLogEntry('Successfully loaded project from file.', LogType.SUCCESS);
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Could not read file.';
        setErrorMessage(`Failed to load project file: ${message}`);
        setAppState(AppState.ERROR); // Go to error state to show message
    }
  };


  const renderError = (message: string) => (
    <div className="text-center bg-red-900/20 border border-red-500 p-8 rounded-lg">
      <h2 className="text-2xl font-bold text-red-400 mb-4">Error</h2>
      <p className="text-red-300">{message}</p>
      <button
        onClick={handleRetry}
        className="mt-6 px-6 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
        Try Again
      </button>
    </div>
  );

  return (
    <div className="h-screen bg-black text-gray-200 flex flex-col font-sans overflow-hidden">
      {showApiKeyDialog && (
        <ApiKeyDialog onContinue={handleApiKeyDialogContinue} />
      )}
      <header className="py-4 flex justify-center items-center px-4 md:px-8 relative z-10 shrink-0">
        <h1 className="text-3xl md:text-5xl font-semibold tracking-wide text-center bg-gradient-to-r from-indigo-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
          VEO 3.1 Prompt Machine
        </h1>
      </header>
      <main className="w-full max-w-7xl mx-auto flex-grow flex flex-col p-2 md:p-4 overflow-y-auto">
        {appState === AppState.IDLE || appState === AppState.LOADING ? (
          <div className="flex-grow flex flex-col justify-center items-center pb-8">
            <ProjectSetupForm
              onGenerate={handleGenerate}
              isGenerating={appState === AppState.LOADING}
              onLoadProject={handleLoadProject}
            />
            {appState === AppState.LOADING && (
              <div className="mt-8">
                <LoadingIndicator />
              </div>
            )}
          </div>
        ) : (
          <div className="flex-grow flex items-center justify-center">
            {appState === AppState.SUCCESS && shotBook && (
              <ShotBookDisplay
                shotBook={shotBook}
                logEntries={logEntries}
                projectName={projectName}
                scenePlans={scenePlans}
                apiCallSummary={apiCallSummary}
                appVersion={PROJECT_VERSION}
                onNewProject={handleNewProject}
                onUpdateShot={handleUpdateShot}
                onGenerateSpecificKeyframe={handleGenerateSpecificKeyframe} // Renamed prop
                allIngredientImages={lastPrompt?.images ?? []}
                onUpdateShotIngredients={handleUpdateShotIngredients}
                onExportAllJsons={handleDownloadAllJsons}
                onExportHtmlReport={handleExportHtmlReport}
                onSaveProject={handleSaveProject}
                onDownloadKeyframesZip={handleDownloadKeyframesZip}
              />
            )}
            {appState === AppState.ERROR &&
              errorMessage &&
              renderError(errorMessage)}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;