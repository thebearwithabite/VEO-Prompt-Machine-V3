/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, {useEffect, useState} from 'react';
import {
  ApiCallSummary,
  IngredientImage,
  LogEntry,
  ProjectAsset,
  ScenePlan,
  Shot,
  ShotBook,
  ShotStatus,
  VeoShotWrapper,
  VeoStatus, // New import
} from '../types';
import ActivityLog from './ActivityLog';
import {
  ArrowPathIcon,
  BracesIcon,
  CheckCircle2Icon,
  ClipboardDocumentIcon,
  ClockIcon,
  DownloadIcon,
  FileArchiveIcon,
  FileJsonIcon,
  FilePenLineIcon,
  FileTextIcon,
  FilmIcon, // Import FilmIcon for the placeholder
  PlusIcon,
  SaveIcon,
  SparklesIcon,
  XMarkIcon,
  RectangleStackIcon,
  InfoIcon,
  StopCircleIcon,
  ClapperboardIcon,
  MessageSquarePlusIcon,
  TerminalIcon,
  VideoIcon,
  SettingsIcon,
  FastForwardIcon, // New Icon
} from './icons';

interface ShotCardProps {
  shot: Shot;
  onUpdateShot: (shot: Shot) => void;
  onGenerateSpecificKeyframe: (shotId: string) => void; 
  onRefineShot: (shotId: string, feedback: string) => void; 
  allAssets: ProjectAsset[];
  onToggleAssetForShot: (shotId: string, assetId: string) => void;
  onGenerateVideo: (shotId: string) => void;
  onExtendVeoVideo: (originalShotId: string, prompt: string) => void; // New prop
}

const ShotCard: React.FC<ShotCardProps> = ({
  shot,
  onUpdateShot,
  onGenerateSpecificKeyframe,
  onRefineShot,
  allAssets,
  onToggleAssetForShot,
  onGenerateVideo,
  onExtendVeoVideo, // Destructure
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedJson, setEditedJson] = useState('');
  const [copyButtonText, setCopyButtonText] = useState('Copy JSON');
  const [isEditingAssets, setIsEditingAssets] = useState(false);
  
  // Director Mode State
  const [isDirectorMode, setIsDirectorMode] = useState(false);
  const [directorFeedback, setDirectorFeedback] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [comfyCopyText, setComfyCopyText] = useState('');

  // Extend Mode State
  const [isExtendMode, setIsExtendMode] = useState(false);
  const [extendPrompt, setExtendPrompt] = useState('');


  useEffect(() => {
    setEditedJson(shot.veoJson ? JSON.stringify(shot.veoJson, null, 2) : '');
  }, [shot.veoJson]);

  // Define renderImagePlaceholder here
  const renderImagePlaceholder = () => {
    switch (shot.status) {
      case ShotStatus.PENDING_JSON:
      case ShotStatus.GENERATING_JSON:
      case ShotStatus.PENDING_KEYFRAME_PROMPT:
      case ShotStatus.GENERATING_KEYFRAME_PROMPT:
      case ShotStatus.NEEDS_KEYFRAME_GENERATION:
      case ShotStatus.GENERATING_IMAGE:
        return (
          <div className="flex flex-col items-center text-gray-400">
            <FilmIcon className="w-12 h-12 mb-2" />
            <span className="text-sm">Generating...</span>
          </div>
        );
      case ShotStatus.GENERATION_FAILED:
        return (
          <div className="flex flex-col items-center text-red-400">
            <XMarkIcon className="w-12 h-12 mb-2" />
            <span className="text-sm">Generation Failed</span>
          </div>
        );
      case ShotStatus.NEEDS_REVIEW:
      default:
        return (
          <div className="flex flex-col items-center text-gray-500">
            <FilmIcon className="w-12 h-12 mb-2" />
            <span className="text-sm">No Keyframe</span>
          </div>
        );
    }
  };

  const handleSaveEdit = () => {
    try {
      const updatedVeoJson: VeoShotWrapper = JSON.parse(editedJson);
      // Here you could add validation against a schema
      onUpdateShot({...shot, veoJson: updatedVeoJson});
      setIsEditing(false);
    } catch (error) {
      alert('Invalid JSON format. Please check your syntax.');
    }
  };

  const handleCopyToClipboard = () => {
    if (!shot.veoJson) return;
    navigator.clipboard.writeText(JSON.stringify(shot.veoJson, null, 2));
    setCopyButtonText('Copied!');
    setTimeout(() => setCopyButtonText('Copy JSON'), 2000);
  };
  
  const handleCopyComfyPayload = () => {
      if (!shot.veoJson || !shot.keyframePromptText) return;
      
      const payload = {
          positive_prompt: shot.keyframePromptText,
          negative_prompt: shot.veoJson.veo_shot.flags.do_not.join(', ') || "blurry, low quality, artifacts, text, watermark",
          aspect_ratio: shot.veoJson.veo_shot.scene.aspect_ratio || "16:9",
          seed: Math.floor(Math.random() * 1000000000), // Random seed for local gen
          // Optional extra metadata
          shot_id: shot.id,
          character_name: shot.veoJson.veo_shot.character.name
      };
      
      navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setComfyCopyText('Copied Payload!');
      setTimeout(() => setComfyCopyText(''), 2000);
  };

  const submitDirectorFeedback = () => {
      if (!directorFeedback.trim()) return;
      setIsRefining(true);
      onRefineShot(shot.id, directorFeedback);
      // The parent will handle the update, we just close the UI
      setIsDirectorMode(false);
      setDirectorFeedback('');
      setIsRefining(false);
  };

  const submitExtension = () => {
      if (!extendPrompt.trim()) return;
      onExtendVeoVideo(shot.id, extendPrompt);
      setIsExtendMode(false);
      setExtendPrompt('');
  };

  const getStatusChip = () => {
    switch (shot.status) {
      case ShotStatus.PENDING_JSON:
        return (
          <span className="bg-gray-700 text-gray-300 text-xs font-medium me-2 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <ClockIcon className="w-3 h-3" /> Queued for JSON
          </span>
        );
      case ShotStatus.GENERATING_JSON:
        return (
          <span className="bg-purple-900 text-purple-300 text-xs font-medium me-2 px-2.5 py-0.5 rounded-full">
            Generating JSON...
          </span>
        );
      case ShotStatus.PENDING_KEYFRAME_PROMPT:
        return (
          <span className="bg-gray-700 text-gray-300 text-xs font-medium me-2 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <ClockIcon className="w-3 h-3" /> Queued for Keyframe Prompt
          </span>
        );
      case ShotStatus.GENERATING_KEYFRAME_PROMPT:
        return (
          <span className="bg-blue-900 text-blue-300 text-xs font-medium me-2 px-2.5 py-0.5 rounded-full">
            Generating Prompt...
          </span>
        );
      case ShotStatus.NEEDS_KEYFRAME_GENERATION:
        return (
          <span className="bg-yellow-900 text-yellow-300 text-xs font-medium me-2 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <SparklesIcon className="w-3 h-3" /> Ready to Generate Keyframe
          </span>
        );
      case ShotStatus.GENERATING_IMAGE:
        return (
          <span className="bg-indigo-900 text-indigo-300 text-xs font-medium me-2 px-2.5 py-0.5 rounded-full">
            Generating Keyframe...
          </span>
        );
      case ShotStatus.NEEDS_REVIEW:
        return (
          <span className="bg-yellow-900 text-yellow-300 text-xs font-medium me-2 px-2.5 py-0.5 rounded-full">
            Needs Review
          </span>
        );
      case ShotStatus.GENERATION_FAILED:
        return (
          <span className="bg-red-900 text-red-300 text-xs font-medium me-2 px-2.5 py-0.5 rounded-full">
            Generation Failed
          </span>
        );
      default:
        return null;
    }
  };

  // Filter assets that have images
  const availableAssets = allAssets.filter(a => !!a.image);
  const selectedAssetIds = shot.selectedAssetIds || [];
  
  const showAssetEditor = isEditingAssets || shot.status === ShotStatus.NEEDS_KEYFRAME_GENERATION;
  
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 md:p-6 transition-all duration-300">
      <div className="flex flex-col md:flex-row items-start gap-4 md:gap-6">
        {/* Left Column: Image, Pitch & Assets */}
        <div className="w-full md:w-1/3 flex-shrink-0">
          <div className="aspect-video bg-black rounded-lg overflow-hidden border border-gray-600 mb-3 flex items-center justify-center relative group">
            {shot.veoStatus === VeoStatus.COMPLETED && shot.veoVideoUrl ? (
                <video 
                    src={shot.veoVideoUrl}
                    controls
                    className="w-full h-full object-cover"
                />
            ) : shot.keyframeImage ? (
              <img
                src={`data:image/png;base64,${shot.keyframeImage}`}
                alt={`Keyframe for ${shot.id}`}
                className="w-full h-full object-cover"
              />
            ) : (
              renderImagePlaceholder()
            )}
            
            {/* Status Overlay for Video Gen */}
            {(shot.veoStatus === VeoStatus.GENERATING || shot.veoStatus === VeoStatus.QUEUED) && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                    <p className="text-white text-xs font-semibold">Generating Video...</p>
                </div>
            )}
            
             {/* Copy ComfyUI Payload Overlay Button */}
             {shot.keyframePromptText && (
                <button 
                    onClick={handleCopyComfyPayload}
                    className="absolute bottom-2 right-2 bg-black/70 hover:bg-black/90 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs border border-gray-500"
                    title="Copy ComfyUI JSON Payload"
                >
                    <TerminalIcon className="w-3 h-3" />
                    {comfyCopyText || 'Copy Payload'}
                </button>
             )}
          </div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-indigo-400">
              {shot.id}
            </h3>
            {getStatusChip()}
          </div>
          {shot.sceneName && (
            <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">
              Scene: {shot.sceneName.replace(/-/g, ' ')}
            </p>
          )}
          <p className="text-sm text-gray-300 bg-gray-900/70 p-3 rounded-md">
            {shot.pitch}
          </p>

          {/* Asset Selection Section */}
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-base font-semibold text-gray-300">
                Key Assets
              </h4>
               {!isEditingAssets && (shot.status === ShotStatus.NEEDS_REVIEW || shot.status === ShotStatus.NEEDS_KEYFRAME_GENERATION || shot.status === ShotStatus.GENERATION_FAILED) && (
                <button
                  onClick={() => setIsEditingAssets(!isEditingAssets)}
                  className="text-indigo-400 hover:text-indigo-300 text-sm font-medium">
                  {isEditingAssets ? 'Done' : 'Edit'}
                </button>
              )}
            </div>

            {showAssetEditor ? (
               <div className="p-3 bg-gray-900/70 rounded-md">
                 <p className="text-xs text-gray-400 mb-3">
                  Select assets to include in the prompt (Max 3).
                 </p>
                 <div className="flex flex-wrap gap-2">
                   {availableAssets.length === 0 && (
                     <p className="text-xs text-gray-500 italic">No assets with images available in library.</p>
                   )}
                   {availableAssets.map(asset => {
                     const isSelected = selectedAssetIds.includes(asset.id);
                     return (
                       <button
                        key={asset.id}
                        onClick={() => onToggleAssetForShot(shot.id, asset.id)}
                        className={`relative group border-2 rounded-lg overflow-hidden w-12 h-12 transition-all ${isSelected ? 'border-green-500' : 'border-transparent opacity-60 hover:opacity-100'}`}
                        title={asset.name}
                       >
                         <img 
                           src={`data:${asset.image!.mimeType};base64,${asset.image!.base64}`} 
                           className="w-full h-full object-cover"
                         />
                         {isSelected && (
                            <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center">
                              <CheckCircle2Icon className="w-4 h-4 text-white drop-shadow-md" />
                            </div>
                         )}
                       </button>
                     )
                   })}
                 </div>
                 <div className="mt-3 flex justify-end">
                    <button onClick={() => setIsEditingAssets(false)} className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-white">Done</button>
                 </div>
               </div>
            ) : (
               <div className="flex flex-wrap gap-2 p-3 bg-gray-900/70 rounded-md min-h-[60px]">
                 {selectedAssetIds.length > 0 ? (
                    selectedAssetIds.map(id => {
                      const asset = allAssets.find(a => a.id === id);
                      if (!asset || !asset.image) return null;
                      return (
                        <div key={id} className="relative group w-12 h-12">
                           <img 
                             src={`data:${asset.image.mimeType};base64,${asset.image.base64}`} 
                             className="w-full h-full object-cover rounded-md border border-gray-600"
                             title={asset.name}
                           />
                        </div>
                      )
                    })
                 ) : (
                    <p className="text-sm text-gray-500 italic self-center">No specific assets assigned.</p>
                 )}
               </div>
            )}
          </div>
        </div>

        {/* Right Column: JSON & Actions */}
        <div className="w-full md:w-2/3">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-md font-semibold text-secondary-dark">VEO 3.1 JSON Prompt</h4>
          </div>
          
          {/* DIRECTOR MODE INPUT */}
          {isDirectorMode && (
              <div className="bg-indigo-900/30 border border-indigo-500 rounded-lg p-4 mb-4 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center gap-2 mb-2">
                      <ClapperboardIcon className="w-5 h-5 text-indigo-400" />
                      <h5 className="font-bold text-indigo-100">Director's Mode</h5>
                  </div>
                  <p className="text-xs text-indigo-300 mb-3">Describe what you want to change. Gemini will update the JSON.</p>
                  <textarea
                    autoFocus
                    value={directorFeedback}
                    onChange={(e) => setDirectorFeedback(e.target.value)}
                    placeholder="e.g., Make the lighting moodier..."
                    className="w-full h-24 bg-black/50 border border-indigo-700 rounded-md p-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <div className="flex justify-end gap-2 mt-3">
                      <button onClick={() => setIsDirectorMode(false)} className="px-3 py-1.5 text-xs text-gray-300 hover:text-white">Cancel</button>
                      <button onClick={submitDirectorFeedback} disabled={!directorFeedback.trim() || isRefining} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded flex items-center gap-2 disabled:bg-gray-700">
                          <MessageSquarePlusIcon className="w-4 h-4" /> Apply & Regenerate
                      </button>
                  </div>
              </div>
          )}

          {/* EXTEND MODE INPUT */}
          {isExtendMode && (
              <div className="bg-green-900/30 border border-green-500 rounded-lg p-4 mb-4 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center gap-2 mb-2">
                      <FastForwardIcon className="w-5 h-5 text-green-400" />
                      <h5 className="font-bold text-green-100">Extend Video</h5>
                  </div>
                  <p className="text-xs text-green-300 mb-3">Describe what happens NEXT in the video extension.</p>
                  <textarea
                    autoFocus
                    value={extendPrompt}
                    onChange={(e) => setExtendPrompt(e.target.value)}
                    placeholder="e.g., The car speeds up and turns the corner..."
                    className="w-full h-24 bg-black/50 border border-green-700 rounded-md p-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                  <div className="flex justify-end gap-2 mt-3">
                      <button onClick={() => setIsExtendMode(false)} className="px-3 py-1.5 text-xs text-gray-300 hover:text-white">Cancel</button>
                      <button onClick={submitExtension} disabled={!extendPrompt.trim()} className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded flex items-center gap-2 disabled:bg-gray-700">
                          <FastForwardIcon className="w-4 h-4" /> Generate Extension
                      </button>
                  </div>
              </div>
          )}

          {!isDirectorMode && !isExtendMode && isEditing ? (
            <textarea
              value={editedJson}
              onChange={(e) => setEditedJson(e.target.value)}
              className="w-full h-80 font-mono text-xs bg-black border border-indigo-500 rounded-md p-2 focus:outline-none resize-y"
            />
          ) : !isDirectorMode && !isExtendMode && (
            <>
              {shot.veoJson?.directorNotes && (
                <div className="bg-gray-700/50 p-3 rounded-md mb-3">
                  <h5 className="text-sm font-semibold text-white mb-1">Director's Notes (Extend Block):</h5>
                  <pre className="whitespace-pre-wrap font-mono text-xs text-gray-300 max-h-24 overflow-y-auto">
                    {shot.veoJson.directorNotes}
                  </pre>
                </div>
              )}
              <pre className="w-full h-80 overflow-auto font-mono text-xs bg-black/50 border border-gray-700 rounded-md p-3">
                <code>
                  {shot.veoJson
                    ? JSON.stringify(shot.veoJson, null, 2)
                    : 'VEO JSON has not been generated yet...'}
                </code>
              </pre>
            </>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            {isEditing ? (
              <button
                onClick={handleSaveEdit}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors text-sm">
                Save Changes
              </button>
            ) : (
              <>
                {!isDirectorMode && !isExtendMode && (
                   <>
                       <button
                            onClick={() => setIsDirectorMode(true)}
                            disabled={!shot.veoJson}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-700 hover:bg-indigo-600 text-white font-semibold rounded-lg transition-colors text-sm border border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ClapperboardIcon className="w-4 h-4" />
                            Director Mode
                        </button>
                        
                        {/* Show Generate Video only if not completed or failed */}
                        {shot.veoStatus !== VeoStatus.COMPLETED && (
                            <button
                                onClick={() => onGenerateVideo(shot.id)}
                                disabled={!shot.veoJson || shot.veoStatus === VeoStatus.GENERATING}
                                className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors text-sm border border-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <VideoIcon className="w-4 h-4" />
                                {shot.veoStatus === VeoStatus.GENERATING ? 'Generating...' : 'Generate Video'}
                            </button>
                        )}
                        
                        {/* Show Extend Video ONLY if completed */}
                        {shot.veoStatus === VeoStatus.COMPLETED && (
                            <button
                                onClick={() => setIsExtendMode(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg transition-colors text-sm border border-green-400"
                            >
                                <FastForwardIcon className="w-4 h-4" />
                                Extend
                            </button>
                        )}

                        {(shot.status === ShotStatus.NEEDS_REVIEW || shot.status === ShotStatus.GENERATION_FAILED || shot.status === ShotStatus.NEEDS_KEYFRAME_GENERATION) && (
                        <button
                            onClick={() => onGenerateSpecificKeyframe(shot.id)}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors text-sm">
                            <ArrowPathIcon className="w-4 h-4" />
                            Regenerate Keyframe
                        </button>
                        )}
                        <button
                        onClick={() => setIsEditing(true)}
                        disabled={!shot.veoJson}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors text-sm disabled:bg-gray-700 disabled:cursor-not-allowed">
                        <FilePenLineIcon className="w-4 h-4" />
                        Edit JSON
                        </button>
                   </>
                )}
              </>
            )}
            <button
              onClick={handleCopyToClipboard}
              disabled={!shot.veoJson}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors text-sm ml-auto disabled:bg-gray-700 disabled:cursor-not-allowed">
              <ClipboardDocumentIcon className="w-4 h-4" />
              {copyButtonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ShotBookDisplayProps {
  shotBook: ShotBook;
  logEntries: LogEntry[];
  projectName: string | null;
  scenePlans: ScenePlan[] | null;
  apiCallSummary: ApiCallSummary;
  appVersion: string;
  onNewProject: () => void;
  onUpdateShot: (shot: Shot) => void;
  onGenerateSpecificKeyframe: (shotId: string) => void; 
  onRefineShot: (shotId: string, feedback: string) => void;
  
  allAssets: ProjectAsset[];
  onToggleAssetForShot: (shotId: string, assetId: string) => void;
  allIngredientImages: IngredientImage[];
  onUpdateShotIngredients: (shotId: string, newImages: IngredientImage[]) => void;

  onExportAllJsons: () => void;
  onExportHtmlReport: () => void; 
  onSaveProject: () => void;
  onDownloadKeyframesZip: () => void;
  onExportPackage: () => void;
  onShowStorageInfo: () => void;
  
  isProcessing: boolean;
  onStopGeneration: () => void;

  veoApiKey: string;
  onSetVeoApiKey: (key: string) => void;
  onGenerateVideo: (shotId: string) => void;
  onExtendVeoVideo: (originalShotId: string, prompt: string) => void; // New
}

const ShotBookDisplay: React.FC<ShotBookDisplayProps> = ({
  shotBook,
  logEntries,
  projectName,
  scenePlans,
  apiCallSummary,
  appVersion,
  onNewProject,
  onUpdateShot,
  onGenerateSpecificKeyframe, 
  onRefineShot,
  allAssets,
  onToggleAssetForShot,
  allIngredientImages,
  onUpdateShotIngredients,
  onExportAllJsons,
  onExportHtmlReport,
  onSaveProject,
  onDownloadKeyframesZip,
  onExportPackage,
  onShowStorageInfo,
  isProcessing,
  onStopGeneration,
  veoApiKey,
  onSetVeoApiKey,
  onGenerateVideo,
  onExtendVeoVideo, // Destructure
}) => {
  const hasJsonForExport = shotBook.some((shot) => !!shot.veoJson);
  const hasKeyframesForExport = shotBook.some((shot) => !!shot.keyframeImage);

  const [showVeoKeySettings, setShowVeoKeySettings] = useState(false);

  const sceneTitles = new Map(
    Array.isArray(scenePlans)
      ? scenePlans.map((plan) => [plan.scene_id, plan.scene_title])
      : [],
  );

  const groupedShots = shotBook.reduce(
    (acc, shot) => {
      const sceneId = shot.id.substring(0, shot.id.lastIndexOf('_'));
      if (!acc[sceneId]) {
        acc[sceneId] = [];
      }
      acc[sceneId].push(shot);
      return acc;
    },
    {} as Record<string, Shot[]>,
  );

  return (
    <div className="w-full h-full flex flex-col gap-4 p-1">
      {/* Header */}
      <header className="flex-shrink-0 bg-[#1f1f1f] border border-gray-700 rounded-2xl shadow-lg p-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-center md:text-left">
          <div className="flex items-center gap-2 justify-center md:justify-start">
            <p className="text-sm text-gray-400">Project</p>
            <button 
                onClick={onShowStorageInfo}
                className="text-gray-500 hover:text-indigo-400 transition-colors p-1 rounded-full hover:bg-white/5"
                title="Storage & Sharing Info"
            >
                <InfoIcon className="w-4 h-4" />
            </button>
          </div>
          <h2 className="text-2xl font-bold text-white">
            {projectName || 'Untitled Project'}
          </h2>
        </div>
        <div className="flex flex-wrap gap-3 justify-center items-center">
          
           {/* Veo API Key Settings */}
          <div className="relative">
              <button 
                  onClick={() => setShowVeoKeySettings(!showVeoKeySettings)}
                  className={`p-2 rounded-lg transition-colors border ${veoApiKey ? 'bg-gray-800 border-gray-600 text-gray-400 hover:text-white' : 'bg-red-900/30 border-red-500 text-red-300 animate-pulse'}`}
                  title="Veo API Settings"
              >
                  <SettingsIcon className="w-5 h-5" />
              </button>
              {showVeoKeySettings && (
                  <div className="absolute top-full right-0 mt-2 w-72 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-4 z-50">
                      <div className="flex justify-between items-center mb-3">
                          <h4 className="font-bold text-white text-sm">Veo API Settings</h4>
                          <button onClick={() => setShowVeoKeySettings(false)} className="text-gray-400 hover:text-white"><XMarkIcon className="w-4 h-4" /></button>
                      </div>
                      <label className="block text-xs text-gray-400 mb-1">API Key (kie.ai)</label>
                      <input 
                          type="password" 
                          value={veoApiKey}
                          onChange={(e) => onSetVeoApiKey(e.target.value)}
                          placeholder="Enter your Veo/Kie API Key"
                          className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500 mb-2"
                      />
                      <p className="text-[10px] text-gray-500">
                          Get your key from <a href="https://kie.ai" target="_blank" className="text-indigo-400 hover:underline">kie.ai</a>. Stored locally.
                      </p>
                  </div>
              )}
          </div>

          <div className="h-6 w-px bg-gray-700 mx-1"></div>

          {isProcessing && (
             <button
                onClick={onStopGeneration}
                className="flex items-center gap-2 px-4 py-2 bg-red-900/80 hover:bg-red-800 text-red-100 font-semibold rounded-lg transition-colors text-sm border border-red-700 animate-pulse"
                title="Stop the current generation process."
             >
                <StopCircleIcon className="w-4 h-4" />
                Stop Generation
             </button>
          )}

          <button
            onClick={onNewProject}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition-colors text-sm">
            New Project
          </button>
           <button
            onClick={onSaveProject}
            title="Save the entire project session to a local .json file."
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition-colors text-sm">
            <SaveIcon className="w-4 h-4" />
            Save Project
          </button>
          <button
             onClick={onExportPackage}
             title="Export structured package for AI File Organizer."
             className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors text-sm border border-green-500">
             <RectangleStackIcon className="w-4 h-4" />
             Export Package
          </button>
          <button
            onClick={onExportHtmlReport}
            title='Download a standalone HTML report of the shot list.'
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition-colors text-sm">
            <FileTextIcon className="w-4 h-4" />
            Report
          </button>
          <button
            onClick={onDownloadKeyframesZip}
            disabled={!hasKeyframesForExport}
            title={!hasKeyframesForExport ? 'No keyframes have been generated yet.' : 'Download all generated keyframes as a .zip file.'}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors text-sm disabled:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50">
            <FileArchiveIcon className="w-4 h-4" />
            Keyframes
          </button>
          <button
            onClick={onExportAllJsons}
            disabled={!hasJsonForExport}
            title={!hasJsonForExport ? 'No shots have generated VEO JSON yet.' : 'Download all VEO JSON prompts.'}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors text-sm disabled:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50">
            <FileJsonIcon className="w-4 h-4" />
            JSONs
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-grow w-full flex flex-col md:flex-row gap-4 overflow-hidden">
        {/* Left Panel: Shot Book */}
        <div className="w-full md:w-2/3 h-full flex flex-col gap-4 overflow-y-auto pr-2">
          {/* Add explicit type assertion for Object.entries to clarify its return type */}
          {(Object.entries(groupedShots) as [string, Shot[]][]).map(([sceneId, shotsInScene]) => (
            <div key={sceneId}>
              <div className="bg-gray-900/50 p-3 rounded-t-lg border-b-2 border-indigo-500">
                <p className="text-xs uppercase tracking-wider text-gray-400">
                  {sceneId.replace(/_/g, ' ')}
                </p>
                <h3 className="text-xl font-semibold text-white">
                  {sceneTitles.get(sceneId) || 'Untitled Scene'}
                </h3>
              </div>
              <div className="flex flex-col gap-4 mt-4">
                {shotsInScene.map((shot) => (
                  <ShotCard
                    key={shot.id}
                    shot={shot}
                    onUpdateShot={onUpdateShot}
                    onGenerateSpecificKeyframe={onGenerateSpecificKeyframe} 
                    onRefineShot={onRefineShot} 
                    allAssets={allAssets}
                    onToggleAssetForShot={onToggleAssetForShot}
                    onGenerateVideo={onGenerateVideo}
                    onExtendVeoVideo={onExtendVeoVideo} // Pass
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Right Panel: Activity Log */}
        <div className="w-full md:w-1/3 h-full">
          <ActivityLog entries={logEntries} />
        </div>
      </div>
    </div>
  );
};

export default ShotBookDisplay;