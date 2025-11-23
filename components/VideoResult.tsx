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
  InfoIcon, // New import
  StopCircleIcon, // New import
} from './icons';

interface ShotCardProps {
  shot: Shot;
  onUpdateShot: (shot: Shot) => void;
  onGenerateSpecificKeyframe: (shotId: string) => void; // Renamed from onRetryKeyframe
  allAssets: ProjectAsset[];
  onToggleAssetForShot: (shotId: string, assetId: string) => void;
}

const ShotCard: React.FC<ShotCardProps> = ({
  shot,
  onUpdateShot,
  onGenerateSpecificKeyframe, // Renamed prop
  allAssets,
  onToggleAssetForShot,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedJson, setEditedJson] = useState('');
  const [copyButtonText, setCopyButtonText] = useState('Copy JSON');
  const [isEditingAssets, setIsEditingAssets] = useState(false);


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
          <div className="aspect-video bg-black rounded-lg overflow-hidden border border-gray-600 mb-3 flex items-center justify-center">
            {shot.keyframeImage ? (
              <img
                src={`data:image/png;base64,${shot.keyframeImage}`}
                alt={`Keyframe for ${shot.id}`}
                className="w-full h-full object-cover"
              />
            ) : (
              renderImagePlaceholder()
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
          {isEditing ? (
            <textarea
              value={editedJson}
              onChange={(e) => setEditedJson(e.target.value)}
              className="w-full h-80 font-mono text-xs bg-black border border-indigo-500 rounded-md p-2 focus:outline-none resize-y"
            />
          ) : (
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
                {(shot.status === ShotStatus.NEEDS_REVIEW || shot.status === ShotStatus.GENERATION_FAILED || shot.status === ShotStatus.NEEDS_KEYFRAME_GENERATION) && (
                   <button
                    onClick={() => onGenerateSpecificKeyframe(shot.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors text-sm">
                    <ArrowPathIcon className="w-4 h-4" />
                    Regenerate Keyframe
                  </button>
                )}
                <button
                  onClick={() => setIsEditing(true)}
                  disabled={!shot.veoJson}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition-colors text-sm disabled:bg-gray-700 disabled:cursor-not-allowed">
                  <FilePenLineIcon className="w-4 h-4" />
                  Edit JSON
                </button>
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
  appVersion: string; // New prop for app version
  onNewProject: () => void;
  onUpdateShot: (shot: Shot) => void;
  onGenerateSpecificKeyframe: (shotId: string) => void; // Renamed prop
  
  // Props for assets
  allAssets: ProjectAsset[];
  onToggleAssetForShot: (shotId: string, assetId: string) => void;
  
  // Legacy / unused but kept for type safety if needed elsewhere
  allIngredientImages: IngredientImage[];
  onUpdateShotIngredients: (
    shotId: string,
    newImages: IngredientImage[],
  ) => void;

  onExportAllJsons: () => void;
  onExportHtmlReport: () => void; 
  onSaveProject: () => void;
  onDownloadKeyframesZip: () => void;
  // New prop for organizer export
  onExportPackage: () => void;
  onShowStorageInfo: () => void; // New Prop
  
  // New props for stop processing
  isProcessing: boolean;
  onStopGeneration: () => void;
}

const ShotBookDisplay: React.FC<ShotBookDisplayProps> = ({
  shotBook,
  logEntries,
  projectName,
  scenePlans,
  apiCallSummary,
  appVersion, // Destructure new prop
  onNewProject,
  onUpdateShot,
  onGenerateSpecificKeyframe, // Renamed prop
  allAssets,
  onToggleAssetForShot,
  allIngredientImages, // Destructured but mostly unused in favor of allAssets
  onUpdateShotIngredients,
  onExportAllJsons,
  onExportHtmlReport,
  onSaveProject,
  onDownloadKeyframesZip,
  onExportPackage, // Destructure new export prop
  onShowStorageInfo, // Destructure new prop
  isProcessing,
  onStopGeneration,
}) => {
  const hasJsonForExport = shotBook.some((shot) => !!shot.veoJson);
  const hasKeyframesForExport = shotBook.some((shot) => !!shot.keyframeImage);

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
        <div className="flex flex-wrap gap-3 justify-center">
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
            onClick={onExportHtmlReport} // No longer passing appVersion explicitly here
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
                    onGenerateSpecificKeyframe={onGenerateSpecificKeyframe} // Renamed prop
                    allAssets={allAssets}
                    onToggleAssetForShot={onToggleAssetForShot}
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
