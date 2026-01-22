import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    XMarkIcon,
    FileTextIcon,
    ClockIcon,
    DownloadIcon,
    ArrowPathIcon as RefreshCwIcon,
    TerminalIcon
} from './icons';
import { listFiles, getFileContent } from '../services/cloudService';

// Shim for missing icons to avoid breaking imports
const SearchIcon = (props: any) => (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
);
const ExternalLinkIcon = (props: any) => (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
);
const ChevronRightIcon = (props: any) => (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
);

interface ArchiveViewerProps {
    isOpen: boolean;
    onClose: () => void;
    accessToken: string;
    bucketName: string;
}

interface GCSFile {
    name: string;
    updated: string;
    size: string;
    contentType: string;
}

const ArchiveViewer: React.FC<ArchiveViewerProps> = ({ isOpen, onClose, accessToken, bucketName }) => {
    const [files, setFiles] = useState<GCSFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [fetchingContent, setFetchingContent] = useState(false);

    useEffect(() => {
        if (isOpen && accessToken) {
            loadFiles();
        }
    }, [isOpen, accessToken]);

    const loadFiles = async () => {
        setLoading(true);
        try {
            const items = await listFiles(accessToken, bucketName);
            // Sort by updated date descending
            const sorted = items.sort((a: any, b: any) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
            setFiles(sorted);
        } catch (e) {
            console.error("Failed to list files:", e);
        } finally {
            setLoading(false);
        }
    };

    const handleFileClick = async (fileName: string) => {
        setSelectedFile(fileName);
        setFetchingContent(true);
        try {
            const content = await getFileContent(fileName, accessToken, bucketName);
            setFileContent(content);
        } catch (e) {
            setFileContent("Error loading file content.");
        } finally {
            setFetchingContent(false);
        }
    };

    const filteredFiles = files.filter(f =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-6xl h-[85vh] bg-[#0a0a0a] border border-gray-800 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <header className="p-8 border-b border-gray-800 flex items-center justify-between bg-gradient-to-r from-gray-900/50 to-transparent">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                                    <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">GCP Cloud Archive</h2>
                                </div>
                                <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">
                                    Storage Bucket: <span className="text-indigo-400">{bucketName}</span>
                                </p>
                            </div>

                            <div className="flex items-center gap-4">
                                <button
                                    onClick={loadFiles}
                                    className="p-3 bg-gray-900 border border-gray-800 rounded-xl text-gray-400 hover:text-white transition-all"
                                >
                                    <RefreshCwIcon className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={onClose}
                                    className="p-3 bg-red-600/10 border border-red-600/30 rounded-xl text-red-500 hover:bg-red-600 hover:text-white transition-all"
                                >
                                    <XMarkIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </header>

                        <div className="flex-grow flex overflow-hidden">
                            {/* Sidebar: File List */}
                            <div className="w-1/3 border-r border-gray-800 flex flex-col bg-gray-900/20">
                                <div className="p-6 border-b border-gray-800">
                                    <div className="relative">
                                        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                        <input
                                            type="text"
                                            placeholder="Search archives..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full bg-black/40 border border-gray-800 rounded-2xl pl-12 pr-4 py-3 text-xs text-white focus:border-indigo-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="flex-grow overflow-y-auto p-4 space-y-2 custom-scrollbar">
                                    {loading ? (
                                        <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                                            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                            <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest">Syncing Vault...</p>
                                        </div>
                                    ) : filteredFiles.length === 0 ? (
                                        <div className="text-center py-20">
                                            <p className="text-gray-600 text-[10px] uppercase font-black">No matching records found.</p>
                                        </div>
                                    ) : (
                                        filteredFiles.map((file) => (
                                            <motion.div
                                                key={file.name}
                                                whileHover={{ x: 5 }}
                                                onClick={() => handleFileClick(file.name)}
                                                className={`p-4 rounded-2xl cursor-pointer transition-all border ${selectedFile === file.name
                                                        ? 'bg-indigo-600 border-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.2)]'
                                                        : 'bg-black/20 border-gray-800 hover:border-gray-700'
                                                    }`}
                                            >
                                                <div className="flex items-start gap-4">
                                                    <div className={`p-2 rounded-lg ${selectedFile === file.name ? 'bg-indigo-500/20' : 'bg-gray-800/40'}`}>
                                                        <FileTextIcon className={`w-4 h-4 ${selectedFile === file.name ? 'text-white' : 'text-indigo-400'}`} />
                                                    </div>
                                                    <div className="flex-grow min-w-0">
                                                        <h4 className={`text-[11px] font-bold truncate ${selectedFile === file.name ? 'text-white' : 'text-gray-300'}`}>
                                                            {file.name}
                                                        </h4>
                                                        <div className="flex items-center gap-3 mt-1 text-[9px] font-mono opacity-60">
                                                            <span className="flex items-center gap-1">
                                                                <ClockIcon className="w-2 h-2" />
                                                                {new Date(file.updated).toLocaleDateString()}
                                                            </span>
                                                            <span>{(parseInt(file.size) / 1024).toFixed(1)} KB</span>
                                                        </div>
                                                    </div>
                                                    <ChevronRightIcon className={`w-4 h-4 self-center ${selectedFile === file.name ? 'text-white' : 'text-gray-700'}`} />
                                                </div>
                                            </motion.div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Main: Content Viewer */}
                            <div className="flex-grow flex flex-col bg-black/40 relative">
                                <AnimatePresence mode="wait">
                                    {!selectedFile ? (
                                        <motion.div
                                            key="empty"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="flex-grow flex flex-col items-center justify-center p-20 text-center"
                                        >
                                            <TerminalIcon className="w-20 h-20 text-gray-800 mb-6" />
                                            <h3 className="text-xl font-black italic uppercase text-gray-600 mb-2">Select a case file</h3>
                                            <p className="text-xs text-gray-700 max-w-xs uppercase font-bold tracking-tight">
                                                Select an archived neural audit from the manifest to view forensic data.
                                            </p>
                                        </motion.div>
                                    ) : fetchingContent ? (
                                        <motion.div
                                            key="loading"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="flex-grow flex flex-col items-center justify-center p-20"
                                        >
                                            <div className="w-12 h-12 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                                            <p className="text-[10px] text-yellow-500 uppercase font-black animate-pulse">Retrieving forensic payload...</p>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="content"
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="flex-grow overflow-y-auto p-12 custom-scrollbar"
                                        >
                                            <div className="max-w-3xl mx-auto">
                                                <div className="flex items-center justify-between mb-8 border-b border-gray-800 pb-8">
                                                    <h2 className="text-3xl font-black italic uppercase text-white tracking-tighter">
                                                        {selectedFile.split(' - ').slice(1).join(' - ')}
                                                    </h2>
                                                    <div className="flex gap-2">
                                                        <a
                                                            href={`https://storage.cloud.google.com/${bucketName}/${selectedFile}`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-xl text-gray-400 text-[10px] font-black uppercase hover:text-white transition-all flex items-center gap-2"
                                                        >
                                                            <ExternalLinkIcon className="w-3 h-3" /> Native GCS
                                                        </a>
                                                    </div>
                                                </div>

                                                <div className="prose prose-invert max-w-none text-gray-400 font-serif italic text-lg leading-relaxed">
                                                    {fileContent?.split('\n').map((line, i) => {
                                                        if (line.startsWith('# ')) return <h1 key={i} className="text-4xl font-black italic uppercase text-white mt-12 mb-6 tracking-tighter border-l-4 border-indigo-500 pl-6">{line.substring(2)}</h1>;
                                                        if (line.startsWith('## ')) return <h2 key={i} className="text-2xl font-black italic uppercase text-indigo-400 mt-10 mb-4 tracking-tight">{line.substring(3)}</h2>;
                                                        if (line.startsWith('### ')) return <h3 key={i} className="text-xl font-bold italic text-yellow-500 mt-8 mb-3">{line.substring(4)}</h3>;
                                                        if (line.startsWith('> ')) return <blockquote key={i} className="border-l-2 border-gray-700 pl-6 my-6 text-gray-500 font-sans not-italic text-sm uppercase tracking-wide">{line.substring(2)}</blockquote>;
                                                        if (line.startsWith('**')) return <p key={i} className="my-4 font-bold text-gray-300">{line}</p>;
                                                        if (line.includes('|')) {
                                                            // Simplified table rendering
                                                            if (line.includes('---')) return <div key={i} className="h-px bg-gray-800 my-2" />;
                                                            return <div key={i} className="grid grid-cols-3 gap-4 py-2 border-b border-gray-900 text-xs font-mono">{line.split('|').filter(s => s.trim()).map((cell, ci) => <span key={ci} className={ci === 0 ? 'text-indigo-400 font-bold' : ''}>{cell.trim()}</span>)}</div>;
                                                        }
                                                        if (line.startsWith('```')) return null; // Simple MD parser ignore code blocks
                                                        return <p key={i} className="my-4">{line}</p>;
                                                    })}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Actions Footer */}
                        <footer className="p-6 border-t border-gray-800 bg-gray-900/50 flex justify-between items-center">
                            <div className="flex items-center gap-4 text-[9px] font-mono text-gray-600 uppercase">
                                <span>Total Files: {files.length}</span>
                                <span className="w-1 h-1 rounded-full bg-gray-800"></span>
                                <span>Filtered: {filteredFiles.length}</span>
                            </div>
                            <p className="text-[9px] font-mono text-gray-500 italic">
                                Secure link active via neural-access-token
                            </p>
                        </footer>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ArchiveViewer;