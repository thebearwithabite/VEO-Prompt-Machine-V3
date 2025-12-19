
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, {useRef, useState} from 'react';
import {ProjectAsset} from '../types';
import { ArrowRightIcon, FileUploadIcon, FileAudioIcon, RectangleStackIcon, UploadCloudIcon } from './icons';
import AssetLibrary from './AssetLibrary';

interface ProjectSetupFormProps {
  onGenerate: (script: string, createKeyframes: boolean) => void;
  isGenerating: boolean;
  onLoadProject: (jsonString: string) => void;
  onArchiveProject: (jsonString: string) => void;
  assets: ProjectAsset[];
  onAnalyzeScriptForAssets: (script: string) => void;
  isAnalyzingAssets: boolean;
  onAddAsset: (asset: ProjectAsset) => void;
  onRemoveAsset: (id: string) => void;
  onUpdateAssetImage: (id: string, file: File) => void;
}

const ProjectSetupForm: React.FC<ProjectSetupFormProps> = ({
  onGenerate, isGenerating, assets, onAnalyzeScriptForAssets, isAnalyzingAssets, onAddAsset, onRemoveAsset, onUpdateAssetImage, onLoadProject, onArchiveProject
}) => {
  const [script, setScript] = useState('');
  const [createKeyframes, setCreateKeyframes] = useState(true);
  const scriptFileInputRef = useRef<HTMLInputElement>(null);
  const projectFileInputRef = useRef<HTMLInputElement>(null);
  const archiveFileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (script.trim() && !isGenerating) onGenerate(script, createKeyframes);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, callback: (s: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) callback(event.target.result as string);
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset for re-upload
  };

  return (
    <div className="w-full max-w-5xl p-1 bg-transparent flex flex-col gap-12">
      {/* Visual Identity First */}
      <section className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-indigo-900 text-indigo-400 flex items-center justify-center font-black text-xs">01</span>
                  <h2 className="text-sm font-black text-gray-500 uppercase tracking-widest">World Artifacts & Entities</h2>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <button 
                  onClick={() => projectFileInputRef.current?.click()}
                  className="flex-1 md:flex-none px-4 py-2 bg-gray-900 border border-gray-800 rounded-xl text-[10px] font-black uppercase text-gray-400 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                    <RectangleStackIcon className="w-4 h-4" /> Ingest Archive
                </button>
                <button 
                  onClick={() => archiveFileInputRef.current?.click()}
                  className="flex-1 md:flex-none px-4 py-2 bg-indigo-950/30 border border-indigo-500/30 rounded-xl text-[10px] font-black uppercase text-indigo-400 hover:bg-indigo-900/40 hover:text-white transition-all flex items-center justify-center gap-2"
                  title="Directly upload a .json project file to the vault for long-term archival and learning loops."
                >
                    <UploadCloudIcon className="w-4 h-4" /> Cloud Archive
                </button>
              </div>
              <input type="file" ref={projectFileInputRef} onChange={(e) => handleFileChange(e, onLoadProject)} accept=".json" className="hidden" />
              <input type="file" ref={archiveFileInputRef} onChange={(e) => handleFileChange(e, onArchiveProject)} accept=".json" className="hidden" />
          </div>
          <AssetLibrary 
            assets={assets} onAddAsset={onAddAsset} onRemoveAsset={onRemoveAsset} onUpdateAssetImage={onUpdateAssetImage} 
            onAnalyzeScript={() => onAnalyzeScriptForAssets(script)} isAnalyzing={isAnalyzingAssets} hasScript={!!script.trim()} 
          />
      </section>

      {/* Narrative beats */}
      <section className="animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
        <div className="flex items-center gap-3 mb-6">
            <span className="w-8 h-8 rounded-full bg-pink-900 text-pink-400 flex items-center justify-center font-black text-xs">02</span>
            <h2 className="text-sm font-black text-gray-500 uppercase tracking-widest">Script Manifest</h2>
        </div>
        <div className="bg-gray-900/40 border border-gray-800 rounded-3xl p-8 backdrop-blur-xl">
            <div className="flex justify-between items-center mb-6">
                <p className="text-xs text-gray-500 font-medium">Upload script or audio to generate the VEO timeline.</p>
                <div className="flex gap-2">
                    <button type="button" onClick={() => scriptFileInputRef.current?.click()} className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 text-gray-400"><FileUploadIcon className="w-4 h-4" /></button>
                    <button type="button" className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 text-gray-400"><FileAudioIcon className="w-4 h-4" /></button>
                </div>
            </div>
            <textarea 
                value={script} onChange={(e) => setScript(e.target.value)}
                placeholder="INT. STUDIO - DAY. Your story begins here..."
                className="w-full h-48 bg-black/40 border border-gray-800 rounded-2xl p-6 text-gray-300 focus:outline-none focus:border-indigo-500 transition-all font-serif italic text-lg leading-relaxed shadow-inner"
            />
            <div className="mt-8 flex justify-between items-center">
                <label className="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" checked={createKeyframes} onChange={(e) => setCreateKeyframes(e.target.checked)} className="hidden" />
                    <div className={`w-10 h-5 rounded-full transition-all border ${createKeyframes ? 'bg-indigo-600 border-indigo-400' : 'bg-gray-800 border-gray-700'}`}>
                        <div className={`w-3 h-3 bg-white rounded-full mt-0.5 transition-all ${createKeyframes ? 'ml-6' : 'ml-1'}`}></div>
                    </div>
                    <span className="text-[10px] font-black uppercase text-gray-600 group-hover:text-gray-400">Auto-Generate Stills</span>
                </label>
                <button onClick={handleSubmit} disabled={!script.trim() || isGenerating} className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl uppercase italic tracking-tighter text-sm transition-all shadow-[0_10px_30px_rgba(79,70,229,0.3)] flex items-center gap-3">Initiate Breakdown <ArrowRightIcon className="w-4 h-4" /></button>
            </div>
        </div>
      </section>
      <input type="file" ref={scriptFileInputRef} className="hidden" />
    </div>
  );
};

export default ProjectSetupForm;
