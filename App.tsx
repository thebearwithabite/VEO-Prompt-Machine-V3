
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
declare const JSZip: any; 
import React, {useEffect, useRef, useState} from 'react';
import ApiKeyDialog from './components/ApiKeyDialog';
import LoadingIndicator from './components/LoadingIndicator';
import ProjectSetupForm from './components/PromptForm';
import ConfirmDialog from './components/ConfirmDialog';
import ShotBookDisplay from './components/VideoResult';
import { StopCircleIcon, KeyIcon, RectangleStackIcon, SaveIcon } from './components/icons';
import {
  generateKeyframeImage,
  generateKeyframePromptText,
  generateProjectName,
  generateSceneNames,
  generateShotList,
  generateVeoJson,
  extractAssetsFromScript,
  refineVeoJson,
  generateVeoExtensionJson,
  analyzeVisualIdentity,
  embedArtifactData,
  generateProjectSummary
} from './services/geminiService';
import { getVeoTaskDetails } from './services/veoService';
import {
    uploadToGCS,
    fetchSecretKey,
    listProjectsFromVault,
    vaultAssetToLibrary,
    proxyVeoToVault,
    legacyProjectInstaller,
    updateWorldRegistry,
    DEFAULT_BUCKET
} from './services/cloudService';
import {
  AppState,
  IngredientImage,
  LogType,
  Shot,
  ShotBook,
  ShotStatus,
  ProjectAsset,
  VeoStatus,
} from './types';
import { metadata } from '@/metadata';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const API_CALL_DELAY_MS = 1200; 
const LOCAL_STORAGE_KEY = 'veoPromptMachineState';
const PROJECT_VERSION = metadata.version || '0.0.0';

const ownerEmail = 'director@aether.studio';

/**
 * UTF-8 safe base64 encoding for JSON states containing binary-like strings
 */
const safeB64Encode = (str: string) => {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
        return String.fromCharCode(parseInt(p1, 16));
    }));
};

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
  const [projectName, setProjectName] = useState<string | null>(null);
  const [veoApiKey, setVeoApiKey] = useState<string>('');
  const [gcpToken, setGcpToken] = useState<string>('');
  const [vaultProjects, setVaultProjects] = useState<string[]>([]);
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [isAnalyzingAssets, setIsAnalyzingAssets] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const stopGenerationRef = useRef(false);
  const [logEntries, setLogEntries] = useState<{timestamp: string; message: string; type: LogType}[]>([]);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);

  useEffect(() => {
    const checkApiKey = async () => {
      const aistudio = (window as any).aistudio;
      if (typeof aistudio?.hasSelectedApiKey === 'function') {
        const hasKey = await aistudio.hasSelectedApiKey();
        if (!hasKey) {
          setShowApiKeyDialog(true);
        }
      }
    };
    checkApiKey();
  }, []);

  useEffect(() => {
    if (gcpToken) listProjectsFromVault(gcpToken).then(setVaultProjects).catch(console.error);
  }, [gcpToken]);

  const addLogEntry = (message: string, type: LogType = LogType.INFO) => {
    setLogEntries((prev) => [...prev, {timestamp: new Date().toLocaleTimeString(), message, type}]);
  };

  const handleUpdateAssetImage = async (id: string, file: File) => {
      try {
          const base64 = await fileToBase64(file);
          const asset = assets.find(a => a.id === id);
          if (!asset) return;

          addLogEntry(`Vision Agent: Analyzing identity for ${asset.name}...`, LogType.INFO);
          const visionMeta = await analyzeVisualIdentity(base64, file.type);
          const semanticFingerprint = await embedArtifactData(`${asset.name}: ${visionMeta.detailed_description}`);
          
          if (gcpToken) {
              addLogEntry(`Vault: Storing semantic fingerprint for ${asset.name}.`, LogType.SUCCESS);
              await vaultAssetToLibrary(asset.type, asset.name, base64, { ...visionMeta, semantic_fingerprint: semanticFingerprint }, gcpToken);
          }

          setAssets(prev => prev.map(a => a.id === id ? { 
            ...a, 
            image: { base64, mimeType: file.type },
            description: visionMeta.detailed_description 
          } : a));
      } catch (e) {
          addLogEntry(`Vision Agent Failed: ${(e as Error).message}`, LogType.ERROR);
      }
  };

  const handleInstallLegacyProject = async (slug: string) => {
      if (!gcpToken) return;
      setAppState(AppState.LOADING);
      addLogEntry(`Installing legacy project artifacts for: ${slug}...`, LogType.INFO);
      try {
          const state = await legacyProjectInstaller(slug, gcpToken);
          setShotBook(state.shotBook);
          setProjectName(state.projectName);
          setAssets(state.assets || []);
          setAppState(AppState.SUCCESS);
          addLogEntry(`Artifact injection successful for ${slug}.`, LogType.SUCCESS);
      } catch (e) {
          setAppState(AppState.IDLE);
          addLogEntry(`Installation failed: ${(e as Error).message}`, LogType.ERROR);
      }
  };

  const handleLoadProject = (jsonString: string) => {
    try {
      const state = JSON.parse(jsonString);
      if (state.shotBook && state.projectName) {
        setShotBook(state.shotBook);
        setProjectName(state.projectName);
        setAssets(state.assets || []);
        setAppState(AppState.SUCCESS);
        addLogEntry(`Local project archive ingested: ${state.projectName}`, LogType.SUCCESS);
      }
    } catch (e) {
      addLogEntry(`Failed to parse local project: ${(e as Error).message}`, LogType.ERROR);
    }
  };

  /**
   * DIRECT ARCHIVE: Uploads a local .json project file straight to the vault
   * without loading it into the workspace. Initiates a learning loop.
   */
  const handleArchiveExternalProject = async (jsonString: string) => {
    if (!gcpToken) {
        addLogEntry("Direct Archive Aborted: Unlock Vault first.", LogType.ERROR);
        return;
    }
    
    setIsProcessing(true);
    addLogEntry("Archive Agent: Initializing direct cloud injection...", LogType.STEP);
    
    try {
        const state = JSON.parse(jsonString);
        const pName = state.projectName || `ext-archive-${Date.now()}`;
        const pAssets = state.assets || [];
        const pShots = state.shotBook || [];

        // Learning Loop: Semantic Summary
        addLogEntry(`Learning Loop: Generating semantic DNA for ${pName}...`, LogType.INFO);
        const summary = await generateProjectSummary(pName, pAssets, pShots);

        // Upload
        const stateB64 = safeB64Encode(jsonString);
        await uploadToGCS(`projects/${pName}/state.json`, stateB64, 'application/json', gcpToken);
        
        await updateWorldRegistry(gcpToken, {
            projects: [pName],
            summaries: { [pName]: summary },
            last_sync: new Date().toISOString()
        });

        addLogEntry(`Permanent Archive Successful: ${pName} injected into World Graph.`, LogType.SUCCESS);
        listProjectsFromVault(gcpToken).then(setVaultProjects).catch(console.error);
    } catch (e) {
        addLogEntry(`Direct Archive Failed: ${(e as Error).message}`, LogType.ERROR);
    } finally {
        setIsProcessing(false);
    }
  };

  const handleCloudSync = async () => {
    if (!gcpToken || !projectName || !shotBook) {
      addLogEntry("Sync Aborted: Missing Cloud Credentials or Project State.", LogType.ERROR);
      return;
    }
    
    setIsProcessing(true);
    addLogEntry(`Vault: Initializing cloud sync for ${projectName}...`, LogType.STEP);
    
    try {
      const state = { projectName, shotBook, assets, version: PROJECT_VERSION, exportedAt: new Date().toISOString() };
      const stateJson = JSON.stringify(state);
      const stateBase64 = safeB64Encode(stateJson); 

      // Learning Loop: Summarization
      addLogEntry("Learning Loop: Distilling project essence for registry...", LogType.INFO);
      const summary = await generateProjectSummary(projectName, assets, shotBook);

      // 1. Upload Full State
      await uploadToGCS(`projects/${projectName}/state.json`, stateBase64, 'application/json', gcpToken);
      
      // 2. Update World Registry with Summary
      await updateWorldRegistry(gcpToken, {
        projects: [projectName],
        summaries: { [projectName]: summary },
        last_sync: new Date().toISOString()
      });

      addLogEntry(`Vault Sync Complete: ${projectName} is now persistent and indexed.`, LogType.SUCCESS);
      listProjectsFromVault(gcpToken).then(setVaultProjects).catch(console.error);
    } catch (e) {
      addLogEntry(`Vault Sync Failed: ${(e as Error).message}`, LogType.ERROR);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnalyzeScriptForAssets = async (script: string) => {
    if (!script.trim()) return;
    setIsAnalyzingAssets(true);
    addLogEntry("Vision Agent: Harvesting narrative artifacts from script...", LogType.STEP);
    try {
      const { result } = await extractAssetsFromScript(script);
      setAssets(result);
      addLogEntry(`Harvest Complete: ${result.length} artifacts extracted.`, LogType.SUCCESS);
    } catch (e) {
      addLogEntry(`Agent Failure: ${(e as Error).message}`, LogType.ERROR);
    } finally {
      setIsAnalyzingAssets(false);
    }
  };

  const handleGenerate = async (scriptInput: string, createKeyframes: boolean) => {
    stopGenerationRef.current = false;
    setIsProcessing(true);
    setAppState(AppState.LOADING);
    setLogEntries([]);
    try {
      const nameData = await generateProjectName(scriptInput);
      setProjectName(nameData.result);
      const shotListData = await generateShotList(scriptInput);
      const initialShots: Shot[] = shotListData.result.map((s: any) => ({
        id: s.shot_id, status: ShotStatus.PENDING_JSON, pitch: s.pitch, selectedAssetIds: []
      }));
      setShotBook(initialShots);

      let finalShots = [...initialShots];
      for (let i = 0; i < finalShots.length; i++) {
        if (stopGenerationRef.current) break;
        const shot = finalShots[i];
        const matchedAssetIds = assets.filter(a => shot.pitch.toLowerCase().includes(a.name.toLowerCase())).map(a => a.id);
        finalShots[i].selectedAssetIds = matchedAssetIds;
        
        const jsonData = await generateVeoJson(shot.pitch, shot.id, scriptInput, null);
        finalShots[i].veoJson = jsonData.result;

        if (createKeyframes && shot.veoJson) {
            const promptData = await generateKeyframePromptText(shot.veoJson.veo_shot);
            const ingredientImages = matchedAssetIds.map(id => assets.find(a => a.id === id)?.image).filter(Boolean) as IngredientImage[];
            const imageData = await generateKeyframeImage(promptData.result, ingredientImages, shot.veoJson.veo_shot.scene.aspect_ratio);
            
            let cloudRef = undefined;
            if (gcpToken && projectName) {
                cloudRef = await uploadToGCS(`projects/${projectName}/units/${shot.id}/still.png`, imageData.result, 'image/png', gcpToken);
            }
            finalShots[i].keyframeImage = imageData.result;
            finalShots[i].veoReferenceUrl = cloudRef;
            finalShots[i].status = ShotStatus.NEEDS_REVIEW;
        }
        setShotBook([...finalShots]);
        await delay(API_CALL_DELAY_MS);
      }
      setAppState(AppState.SUCCESS);
    } catch (e) { setAppState(AppState.ERROR); } finally { setIsProcessing(false); }
  };

  const handleFetchVeoSecret = async () => {
      try {
          const key = await fetchSecretKey(gcpToken);
          setVeoApiKey(key);
          addLogEntry("Vault Decrypted: Session Active.", LogType.SUCCESS);
      } catch (e) { addLogEntry("Secret Access Denied.", LogType.ERROR); }
  };

  return (
    <div className="min-h-screen font-sans text-gray-100 bg-[#050505]">
      {showApiKeyDialog && <ApiKeyDialog onContinue={() => setShowApiKeyDialog(false)} />}
      
      {appState === AppState.LOADING && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 backdrop-blur-2xl">
           <LoadingIndicator />
           <div className="absolute bottom-10"><button onClick={() => { stopGenerationRef.current = true; setIsProcessing(false); }} className="px-8 py-3 bg-red-950/50 border border-red-500/50 text-red-500 rounded-2xl flex items-center gap-2 hover:bg-red-900/50 transition-all font-black uppercase italic tracking-tighter"><StopCircleIcon className="w-5 h-5" /> Terminate Pipeline</button></div>
        </div>
      )}
      
      <main className="flex flex-col items-center p-4 md:p-8 min-h-screen max-w-[1920px] mx-auto">
        {appState === AppState.IDLE && (
           <div className="flex flex-col items-center w-full max-w-5xl animate-in fade-in zoom-in-95 duration-1000">
             <div className="mb-16 text-center">
                 <div className="flex items-center justify-center gap-4 mb-6">
                    <div className="w-16 h-1 w-24 bg-gradient-to-r from-transparent to-indigo-500 rounded-full"></div>
                    <h1 className="text-7xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-indigo-400 to-purple-600 tracking-tighter italic">AETHER</h1>
                    <div className="w-16 h-1 w-24 bg-gradient-to-l from-transparent to-indigo-500 rounded-full"></div>
                 </div>
                 <p className="text-2xl text-gray-500 max-w-3xl mx-auto font-light leading-tight">Connected World Agent for <strong>{ownerEmail}</strong>. Orchestrating semantic narrative artifacts via <strong>{DEFAULT_BUCKET}</strong>.</p>
                 
                 <div className="mt-8 flex justify-center items-center gap-4">
                     <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-4 flex items-center gap-3 relative">
                        <KeyIcon className="w-5 h-5 text-yellow-500" />
                        <input 
                          id="gcp-token-input"
                          type="password" 
                          value={gcpToken} 
                          onChange={(e) => setGcpToken(e.target.value)} 
                          placeholder="Master Cloud Token..." 
                          className="bg-transparent border-none focus:ring-0 text-sm font-mono w-48 text-indigo-400 placeholder:text-gray-700" 
                        />
                        <button id="vault-unlock-btn" onClick={handleFetchVeoSecret} disabled={!gcpToken} className="px-3 py-1 bg-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all disabled:opacity-30">Unlock Vault</button>
                        <div className="absolute -top-6 right-0 text-[8px] font-black text-indigo-500 uppercase tracking-widest opacity-40">Ready for Vault Key Injection</div>
                     </div>
                 </div>
             </div>
             
             <ProjectSetupForm 
                onGenerate={handleGenerate}
                isGenerating={false}
                onLoadProject={handleLoadProject}
                onArchiveProject={handleArchiveExternalProject}
                assets={assets}
                onAnalyzeScriptForAssets={handleAnalyzeScriptForAssets}
                isAnalyzingAssets={isAnalyzingAssets}
                onAddAsset={(a) => setAssets(prev => [...prev, a])}
                onRemoveAsset={(id) => setAssets(prev => prev.filter(a => a.id !== id))}
                onUpdateAssetImage={handleUpdateAssetImage}
             />
             
             {vaultProjects.length > 0 && (
                 <div className="mt-20 w-full animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-500">
                     <div className="flex items-center gap-4 mb-8">
                         <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.5em] whitespace-nowrap">Legacy Project Registry</h4>
                         <div className="h-px w-full bg-indigo-900/50"></div>
                     </div>
                     <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                         {vaultProjects.map(p => (
                             <button 
                                key={p} 
                                onClick={() => handleInstallLegacyProject(p)}
                                className="group p-4 bg-gray-950 border border-gray-900 rounded-2xl text-left hover:border-indigo-500/50 hover:bg-indigo-900/5 transition-all shadow-2xl"
                             >
                                <RectangleStackIcon className="w-5 h-5 text-gray-600 mb-3 group-hover:text-indigo-400 transition-colors" />
                                <div className="text-xs font-bold text-gray-400 group-hover:text-white transition-colors truncate font-mono lowercase">{p}</div>
                                <div className="text-[9px] text-gray-700 mt-1 uppercase tracking-widest font-black">Inject Artifacts</div>
                             </button>
                         ))}
                     </div>
                 </div>
             )}
           </div>
        )}

        {appState !== AppState.IDLE && shotBook && (
           <ShotBookDisplay 
              shotBook={shotBook}
              logEntries={logEntries}
              projectName={projectName}
              scenePlans={null}
              apiCallSummary={{pro:0, flash:0, image:0, proTokens:{input:0, output:0}, flashTokens:{input:0, output:0}}}
              appVersion={PROJECT_VERSION}
              onNewProject={() => setAppState(AppState.IDLE)}
              onUpdateShot={(s) => setShotBook(prev => prev?.map(sh => sh.id === s.id ? s : sh) || null)}
              onGenerateSpecificKeyframe={() => {}}
              onRefineShot={() => {}}
              allAssets={assets}
              onToggleAssetForShot={() => {}}
              allIngredientImages={[]}
              onUpdateShotIngredients={() => {}}
              onExportAllJsons={() => {}}
              onExportHtmlReport={() => {}}
              onSaveProject={() => {}}
              onDownloadKeyframesZip={() => {}}
              onExportPackage={() => {}}
              onShowStorageInfo={() => {}}
              isProcessing={isProcessing}
              onStopGeneration={() => { stopGenerationRef.current = true; }}
              veoApiKey={veoApiKey}
              onSetVeoApiKey={setVeoApiKey}
              onGenerateVideo={() => {}}
              onExtendVeoVideo={() => {}}
              onUploadAdHocAsset={() => {}}
              onRemoveAdHocAsset={() => {}}
              onApproveShot={() => {}}
              gcpToken={gcpToken}
              onSetGcpToken={setGcpToken}
              onFetchVeoSecret={handleFetchVeoSecret}
              onCloudSync={handleCloudSync}
              ownerEmail={ownerEmail}
           />
        )}
      </main>
    </div>
  );
};

export default App;
