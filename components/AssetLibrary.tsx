/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import {AssetType, ProjectAsset} from '../types';
import {
  CheckCircle2Icon,
  PlusIcon,
  SparklesIcon,
  UploadCloudIcon,
  XMarkIcon,
  ClipboardDocumentIcon,
} from './icons';

interface AssetLibraryProps {
  assets: ProjectAsset[];
  onAddAsset: (asset: ProjectAsset) => void;
  onRemoveAsset: (id: string) => void;
  onUpdateAssetImage: (id: string, file: File) => void;
  onAnalyzeScript: () => void;
  isAnalyzing: boolean;
  hasScript: boolean;
}

// Helper to convert file to base64
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });

const AssetLibrary: React.FC<AssetLibraryProps> = ({
  assets,
  onAddAsset,
  onRemoveAsset,
  onUpdateAssetImage,
  onAnalyzeScript,
  isAnalyzing,
  hasScript,
}) => {
  const [allCopied, setAllCopied] = useState(false);
  
  // State for manual entry
  const [addingAssetType, setAddingAssetType] = useState<AssetType | null>(null);
  const [newAssetName, setNewAssetName] = useState('');

  const handleImageUpload = async (
    id: string,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    onUpdateAssetImage(id, file);
  };

  const startAdding = (type: AssetType) => {
    setAddingAssetType(type);
    setNewAssetName('');
  };

  const cancelAdding = () => {
    setAddingAssetType(null);
    setNewAssetName('');
  };

  const confirmAdding = () => {
    if (newAssetName.trim() && addingAssetType) {
      onAddAsset({
        id: `manual-${Date.now()}`,
        name: newAssetName.trim(),
        description: 'Manually added asset',
        type: addingAssetType,
        image: null,
      });
      cancelAdding();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation(); // Stop form submission
      confirmAdding();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancelAdding();
    }
  };

  const handleCopyAllAssets = () => {
    if (assets.length === 0) return;
    
    const text = assets.map(a => 
      `[${a.type.toUpperCase()}]\nName: ${a.name}\nDescription: ${a.description}`
    ).join('\n\n');

    navigator.clipboard.writeText(text);
    setAllCopied(true);
    setTimeout(() => setAllCopied(false), 2000);
  };

  const sections: {type: AssetType, label: string}[] = [
    {type: 'character', label: 'Characters'},
    {type: 'location', label: 'Locations'},
    {type: 'prop', label: 'Props'},
    {type: 'style', label: 'Styles'},
  ];

  return (
    <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-200 flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-indigo-400" />
            Asset Library
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Upload images for characters, locations, props, and styles to ensure consistency across generated shots.
          </p>
        </div>
        <div className="flex gap-2">
           <button
            type="button"
            onClick={handleCopyAllAssets}
            disabled={assets.length === 0}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap">
             {allCopied ? <CheckCircle2Icon className="w-4 h-4 text-green-400" /> : <ClipboardDocumentIcon className="w-4 h-4" />}
             Copy All Descriptions
          </button>
          <button
            type="button"
            onClick={onAnalyzeScript}
            disabled={isAnalyzing || !hasScript}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap">
            {isAnalyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                Analyzing Script...
              </>
            ) : (
              <>
                <SparklesIcon className="w-4 h-4" />
                Auto-Detect Assets
              </>
            )}
          </button>
        </div>
      </div>

      {sections.map((section) => {
        const sectionAssets = assets.filter((a) => a.type === section.type);
        const isAddingThisType = addingAssetType === section.type;

        return (
          <div key={section.type} className="mb-8 last:mb-0">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                {section.label}
              </h4>
              <button
                onClick={() => startAdding(section.type)}
                type="button"
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                <PlusIcon className="w-3 h-3" /> Add {section.label.slice(0, -1)}
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {/* Inline Input Card for New Asset */}
              {isAddingThisType && (
                 <div className="bg-gray-800 rounded-lg border border-indigo-500/50 p-3 flex flex-col justify-center gap-2 animate-in fade-in zoom-in-95 duration-200">
                    <p className="text-xs text-gray-400">New {section.label.slice(0, -1)} Name:</p>
                    <input
                      autoFocus
                      type="text"
                      className="bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500 w-full"
                      placeholder="e.g., Detective John"
                      value={newAssetName}
                      onChange={(e) => setNewAssetName(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <div className="flex gap-2 justify-end mt-1">
                      <button 
                        onClick={cancelAdding} 
                        type="button" 
                        className="text-xs px-2 py-1 text-gray-400 hover:text-white rounded hover:bg-gray-700">
                        Cancel
                      </button>
                      <button 
                        onClick={confirmAdding} 
                        type="button" 
                        className="text-xs px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium">
                        Add
                      </button>
                    </div>
                 </div>
              )}

              {sectionAssets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  onRemove={() => onRemoveAsset(asset.id)}
                  onUpload={(e) => handleImageUpload(asset.id, e)}
                />
              ))}
              
              {sectionAssets.length === 0 && !isAddingThisType && (
                <div className="col-span-full py-8 text-center border-2 border-dashed border-gray-700 rounded-lg text-gray-500 text-sm">
                  No {section.label.toLowerCase()} detected yet. Run analysis or add manually.
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const AssetCard: React.FC<{
  asset: ProjectAsset;
  onRemove: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({asset, onRemove, onUpload}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyDescription = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Copy both name and description for context
    const textToCopy = `Name: ${asset.name}\nDescription: ${asset.description}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative bg-gray-800 rounded-lg border border-gray-700 overflow-hidden flex flex-col">
      <button
        onClick={onRemove}
        type="button"
        className="absolute top-1 right-1 z-10 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <XMarkIcon className="w-3 h-3" />
      </button>

      <div className="aspect-square bg-black relative">
        {asset.image ? (
          <img
            src={`data:${asset.image.mimeType};base64,${asset.image.base64}`}
            alt={asset.name}
            className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
          />
        ) : (
          <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-700/50 transition-colors">
            <UploadCloudIcon className="w-8 h-8 text-gray-600 mb-2" />
            <span className="text-xs text-gray-500">Upload Image</span>
            <input
              type="file"
              className="hidden"
              onChange={onUpload}
              accept="image/png, image/jpeg, image/webp"
            />
          </label>
        )}
        {asset.image && (
           <label className="absolute bottom-2 right-2 bg-black/50 p-1.5 rounded-full cursor-pointer hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity">
             <UploadCloudIcon className="w-4 h-4 text-white" />
              <input
              type="file"
              className="hidden"
              onChange={onUpload}
              accept="image/png, image/jpeg, image/webp"
            />
           </label>
        )}
      </div>

      <div className="p-3 flex-grow flex flex-col">
        <h5 className="text-sm font-bold text-white truncate" title={asset.name}>
          {asset.name}
        </h5>
        <div className="flex items-start justify-between gap-2 mt-1 flex-1">
            <p
            className="text-xs text-gray-400 line-clamp-3"
            title={asset.description}>
            {asset.description}
            </p>
             <button
                type="button"
                onClick={handleCopyDescription}
                className="text-gray-500 hover:text-white transition-colors flex-shrink-0"
                title="Copy Name & Description">
                {copied ? <CheckCircle2Icon className="w-3 h-3 text-green-400" /> : <ClipboardDocumentIcon className="w-3 h-3" />}
            </button>
        </div>
      </div>
      {asset.image && (
        <div className="absolute top-2 left-2 bg-green-500/20 text-green-400 rounded-full p-0.5">
            <CheckCircle2Icon className="w-4 h-4" />
        </div>
      )}
    </div>
  );
};

export default AssetLibrary;