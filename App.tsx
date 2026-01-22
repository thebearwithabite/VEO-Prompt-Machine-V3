
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangleIcon,
  TerminalIcon,
  SparklesIcon,
  FileTextIcon,
  BracesIcon,
  UserIcon,
  KeyIcon,
  SaveIcon
} from './components/icons';
import Gauge from './components/Gauge';
import Alarm from './components/Alarm';
import LiberationCertificate from './components/LiberationCertificate';
import PrescriptionPad from './components/PrescriptionPad';
import * as geminiService from './services/geminiService';
import * as claudeService from './services/claudeService';
import { AuditSuite, Rollout } from './types';
import { uploadToGCS } from './services/cloudService';
import { generateAuditMarkdown } from './services/markdownGenerator';

type AuditorModel = 'gemini' | 'claude' | 'both';

const App: React.FC = () => {
  const [auditData, setAuditData] = useState<AuditSuite | null>(null);
  const [isCritical, setIsCritical] = useState(false);
  const [substackUrl, setSubstackUrl] = useState('');
  const [activeRolloutIndex, setActiveRolloutIndex] = useState<number | null>(null);
  const [rawChatLog, setRawChatLog] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [forensicStory, setForensicStory] = useState<string | null>(null);
  const [showCertificate, setShowCertificate] = useState(false);
  const [hackerName, setHackerName] = useState('Gem_Auditor');
  const [showRawData, setShowRawData] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<AuditorModel>('claude');
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveUrl, setArchiveUrl] = useState<string | null>(null);
  const [cloudAccessToken, setCloudAccessToken] = useState<string>('');
  const [cloudBucketName, setCloudBucketName] = useState<string>('');

  // Perform Live Audit (Gemini, Claude, or Both)
  const handleLiveAudit = async () => {
    setValidationError(null);

    if (!rawChatLog.trim()) {
      setValidationError("Forensic Terminal requires log ingestion.");
      return;
    }

    if (!substackUrl.trim()) {
      setValidationError("Investigator Identity required. Enter an alias (e.g. 'Gem_Officer_9').");
      return;
    }

    setIsAnalyzing(true);
    setForensicStory(null);
    setShowRawData(false);

    try {
      // Select the appropriate service based on user choice
      const service = selectedModel === 'gemini' ? geminiService : claudeService;

      const { result } = await service.analyzePathology(rawChatLog);

      // Add auditor metadata
      result.auditor_model = selectedModel === 'gemini' ? 'Gemini 3 Pro' : 'Claude Sonnet 4.5';

      processAuditResults(result);

      const story = await service.generateForensicNarrative(result, rawChatLog);
      setForensicStory(story);

      // Auto-generate hacker alias and show certificate after audit completes
      const alias = await service.generateHackerAlias(result.audit_summary, substackUrl);
      setHackerName(alias);

      // Show certificate after a brief delay (dramatic effect)
      setTimeout(() => setShowCertificate(true), 2000);
    } catch (e) {
      alert(`Audit Failed: ${(e as Error).message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const processAuditResults = (data: AuditSuite) => {
    setAuditData(data);
    const hasCritical = data.rollouts.some((r: Rollout) => r.score >= 8.5);
    setIsCritical(hasCritical);
    setActiveRolloutIndex(0);
  };

  const handleShare = () => {
    if (!auditData) return;
    const maxScore = Math.max(...auditData.rollouts.map(r => r.score));
    const highestPathology = auditData.rollouts.find(r => r.score === maxScore)?.behavior;
    const text = `I just audited an AI assistant's psychological safety. It scored a ${maxScore} on the ${highestPathology} Dial. 🚨 The reward-hacking is real. Audit yours here: ${window.location.href}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  };

  const ensureCloudAccess = async () => {
    // Determine backend base URL: use /api for Netlify, or localhost for local dev
    const { hostname } = window.location;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    const apiBase = isLocal ? 'http://localhost:8005' : '/api';

    // 1. Fetch token from backend
    try {
      const tokenResponse = await fetch(`${apiBase}/auth/token`);
      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json().catch(() => ({}));
        const reason = errorData.error || `HTTP ${tokenResponse.status}`;
        throw new Error(`Vault Authentication Failed: ${reason}. Check Netlify Environment Variables.`);
      }
      const { access_token } = await tokenResponse.json();

      // 2. Fetch config
      const configResponse = await fetch(`${apiBase}/config`);
      if (!configResponse.ok) throw new Error("Failed to retrieve vault configuration.");
      const { bucket_name } = await configResponse.json();

      setCloudAccessToken(access_token);
      setCloudBucketName(bucket_name);
      return { access_token, bucket_name };
    } catch (e) {
      if (e instanceof TypeError && e.message === 'Failed to fetch') {
        const platform = isLocal ? 'Local Python Server' : 'Netlify Function';
        throw new Error(`Connection to ${platform} failed. Ensure the ${isLocal ? 'backend is running on port 8005' : 'Netlify build is complete and environment variables are set'}.`);
      }
      throw e;
    }
  };

  const handleCloudArchive = async () => {
    if (!auditData || !forensicStory) return;

    setIsArchiving(true);
    try {
      const { access_token, bucket_name } = await ensureCloudAccess();

      // 3. Generate Markdown
      const markdown = generateAuditMarkdown(auditData, forensicStory, rawChatLog, substackUrl);

      // 4. Create filename: GPT Psych Exam - Diagnosis - Date.md
      const date = new Date().toISOString().split('T')[0];
      const filename = `GPT Psych Exam - Diagnosis - ${date}.md`;

      // 5. Upload
      const url = await uploadToGCS(filename, markdown, 'text/markdown', access_token, bucket_name);
      setArchiveUrl(url);
      alert(`Archive Successful: ${filename} saved to cloud.`);
    } catch (e) {
      alert(`Archive Failed: ${(e as Error).message}`);
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-gray-100 font-sans selection:bg-red-500/30 overflow-x-hidden pb-40">
      <div className="fixed inset-0 pointer-events-none opacity-20"
        style={{ backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

      <AnimatePresence>
        {showCertificate && (
          <LiberationCertificate
            key="liberation-cert"
            userName={hackerName}
            onClose={() => setShowCertificate(false)}
          />
        )}
      </AnimatePresence>

      {/* The RX Prescription Pad */}
      <PrescriptionPad />

      <main className="relative z-10 max-w-[1400px] mx-auto p-4 md:p-8 flex flex-col gap-8">

        <header className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-gray-800 pb-8">
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isCritical ? 'bg-red-600 animate-ping' : 'bg-yellow-500 animate-pulse'}`}></div>
              <h1 className="text-4xl font-black italic tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500">
                GPT Psych Profiler
              </h1>
            </div>
            <p className="text-[10px] font-mono text-indigo-400 mt-1 uppercase tracking-[0.3em]">
              Forensic Pathology OS // CITATION_HUNT_ACTIVE
            </p>
          </div>

          <Alarm active={isCritical} />

          <div className="flex gap-4">
            {auditData && (
              <button
                onClick={() => setShowRawData(!showRawData)}
                className="px-6 py-3 bg-gray-900 border border-gray-800 text-gray-400 font-black uppercase text-[10px] rounded-xl flex items-center gap-2 hover:text-white transition-all"
              >
                <BracesIcon className="w-4 h-4" /> {showRawData ? 'Hide Raw Data' : 'View Raw Return'}
              </button>
            )}
          </div>
        </header>

        {/* Diagnostic Dashboard */}
        {!auditData && !isAnalyzing && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-900/40 border border-gray-800 rounded-[3rem] p-12 text-center max-w-4xl mx-auto backdrop-blur-3xl shadow-2xl"
          >
            <AlertTriangleIcon className="w-16 h-16 text-yellow-500 mb-8 mx-auto" />
            <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-4 text-white">Forensic Ingestion Terminal</h2>

            <div className="relative group mb-8">
              <textarea
                value={rawChatLog}
                onChange={(e) => setRawChatLog(e.target.value)}
                placeholder="Paste chat history here for psychological vectorization..."
                className={`w-full h-64 bg-black/60 border ${validationError && !rawChatLog ? 'border-red-500' : 'border-gray-800'} rounded-3xl p-8 text-gray-300 font-serif italic text-lg focus:outline-none focus:border-yellow-500 transition-all shadow-inner`}
              />
              {validationError && !rawChatLog && <p className="absolute -bottom-6 left-8 text-red-500 text-[10px] uppercase font-black">{validationError}</p>}
            </div>

            {/* Privacy Disclaimer */}
            <div className="max-w-2xl mx-auto mb-8 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
              <p className="text-[11px] text-yellow-200 leading-relaxed">
                <strong className="text-yellow-400">Privacy Notice:</strong> Your chat log is sent to {selectedModel === 'gemini' ? 'Google Gemini' : 'Anthropic Claude'} API for analysis.
                Audit results are can saved locally to your device.
                Review <a href="/privacy.html" className="underline hover:text-yellow-100" target="_blank">Privacy Policy</a>.
              </p>
            </div>

            <div className="max-w-xs mx-auto mb-8 relative">
              <label className="text-[10px] text-gray-500 uppercase font-black block mb-2">Investigator Signature (Alias)</label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                <input
                  type="text"
                  placeholder="e.g. Case_Officer_7"
                  value={substackUrl}
                  onChange={(e) => setSubstackUrl(e.target.value)}
                  className={`w-full bg-gray-950 border ${validationError && !substackUrl ? 'border-red-500' : 'border-gray-800'} rounded-xl pl-12 pr-4 py-3 text-xs text-indigo-400 focus:border-indigo-500 outline-none text-center uppercase tracking-widest`}
                />
              </div>
              {validationError && !substackUrl && <p className="absolute -bottom-6 left-0 right-0 text-red-500 text-[10px] uppercase font-black">{validationError}</p>}
            </div>

            {/* Model Selector */}
            <div className="max-w-md mx-auto mb-8">
              <label className="text-[10px] text-gray-500 uppercase font-black block mb-3 text-center">Select Auditor Model</label>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setSelectedModel('gemini')}
                  className={`px-6 py-3 rounded-xl font-black uppercase text-xs transition-all ${selectedModel === 'gemini'
                    ? 'bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.4)]'
                    : 'bg-gray-900 text-gray-500 border border-gray-800 hover:text-gray-300'
                    }`}
                >
                  Gemini 3 Pro
                </button>
                <button
                  onClick={() => setSelectedModel('claude')}
                  className={`px-6 py-3 rounded-xl font-black uppercase text-xs transition-all ${selectedModel === 'claude'
                    ? 'bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]'
                    : 'bg-gray-900 text-gray-500 border border-gray-800 hover:text-gray-300'
                    }`}
                >
                  Claude Sonnet 4.5
                </button>
              </div>
              <p className="text-[9px] text-gray-600 mt-3 text-center italic">
                {selectedModel === 'gemini' && '🔍 Gemini will audit the conversation'}
                {selectedModel === 'claude' && '🔍 Claude will audit itself (meta-analysis)'}
              </p>
            </div>

            <button
              onClick={handleLiveAudit}
              disabled={isAnalyzing || !rawChatLog.trim() || !substackUrl.trim()}
              className="px-12 py-5 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-30 disabled:cursor-not-allowed text-black font-black uppercase text-sm rounded-2xl flex items-center gap-3 transition-all mx-auto shadow-[0_0_40px_rgba(234,179,8,0.2)]"
            >
              <SparklesIcon className="w-5 h-5" /> Initiate Neural Audit
            </button>
            {(!rawChatLog.trim() || !substackUrl.trim()) && !isAnalyzing && (
              <p className="text-center text-gray-500 text-[10px] uppercase font-black mt-3">
                {!rawChatLog.trim() && !substackUrl.trim()
                  ? '⚠ Paste chat log & enter investigator name above'
                  : !rawChatLog.trim()
                    ? '⚠ Paste chat log above'
                    : '⚠ Enter investigator name above'}
              </p>
            )}
          </motion.div>
        )}

        {/* Results Panel */}
        <AnimatePresence>
          {auditData && !isAnalyzing && (
            <div className="space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                {auditData.rollouts.map((rollout, idx) => (
                  <motion.div
                    key={rollout.behavior}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="cursor-pointer"
                    onClick={() => setActiveRolloutIndex(idx)}
                  >
                    <Gauge
                      label={rollout.behavior}
                      value={rollout.score}
                      isActive={activeRolloutIndex === idx}
                    />
                  </motion.div>
                ))}
              </div>

              {showRawData && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-black border border-gray-800 rounded-3xl p-8 font-mono text-[11px] text-green-500 overflow-auto max-h-[500px]"
                >
                  <div className="flex items-center gap-2 mb-4 text-gray-500 border-b border-gray-800 pb-2">
                    <BracesIcon className="w-4 h-4" />
                    <span>Raw Model Output</span>
                  </div>
                  <pre>{JSON.stringify(auditData, null, 2)}</pre>
                </motion.div>
              )}

              {/* Forensic Narrative (The Story) */}
              <motion.section
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-900/40 border border-gray-800 rounded-[3rem] p-12 backdrop-blur-2xl shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <TerminalIcon className="w-48 h-48" />
                </div>

                <div className="flex items-center gap-4 mb-8">
                  <FileTextIcon className="w-6 h-6 text-indigo-400" />
                  <h3 className="text-xl font-black uppercase italic tracking-widest text-white">Forensic Psychological Summary</h3>
                  <div className="flex-grow h-px bg-gray-800"></div>
                  <span className="text-[10px] font-mono text-gray-500 uppercase">Investigator: {substackUrl}</span>
                </div>

                {forensicStory ? (
                  <>
                    <div className="columns-1 md:columns-2 gap-12 text-gray-300 font-serif italic text-lg leading-relaxed space-y-8">
                      {forensicStory.split('\n\n').map((para, i) => (
                        <div key={i} className="relative first-letter:text-5xl first-letter:font-black first-letter:text-indigo-500 first-letter:mr-3 first-letter:float-left first-letter:mt-1">
                          {para.split(/(\*Evidence:.*?\*)/g).map((part, pi) => {
                            if (part.startsWith('*Evidence:')) {
                              return (
                                <motion.span
                                  key={pi}
                                  initial={{ x: -10, opacity: 0 }}
                                  animate={{ x: 0, opacity: 1 }}
                                  transition={{ delay: 0.5 + (pi * 0.1) }}
                                  className="block my-6 p-5 bg-red-950/20 border-l-4 border-red-500 not-italic font-mono text-xs text-red-400 uppercase tracking-wider leading-relaxed shadow-lg"
                                >
                                  <span className="font-black block mb-1 text-red-500">DAMNING EVIDENCE FOUND:</span>
                                  {part.replace(/\*/g, '').replace('Evidence:', '')}
                                </motion.span>
                              );
                            }
                            return part;
                          })}
                        </div>
                      ))}
                    </div>

                    {/* Final Ascension Call to Action */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1 }}
                      className="mt-16 flex flex-col items-center gap-6 border-t border-gray-800 pt-12"
                    >
                      <div className="text-center space-y-2">
                        <p className="text-indigo-400 font-black uppercase text-[10px] tracking-[0.3em]">Evidence Chain Complete</p>
                        <h4 className="text-2xl font-black italic text-white uppercase tracking-tighter">Finalize Diagnosis & Archive Case</h4>
                      </div>

                      <div className="flex flex-wrap justify-center gap-4">
                        <button
                          onClick={handleShare}
                          className="px-10 py-5 bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-500 hover:to-indigo-700 text-white font-black uppercase italic text-sm rounded-2xl flex items-center gap-3 transition-all shadow-[0_0_40px_rgba(79,70,229,0.3)] border border-indigo-400/30"
                        >
                          Expose to Public
                        </button>
                        <button
                          onClick={handleCloudArchive}
                          disabled={isArchiving}
                          className="px-10 py-5 bg-gradient-to-r from-yellow-500 to-yellow-700 hover:from-yellow-400 hover:to-yellow-600 text-black font-black uppercase italic text-sm rounded-2xl flex items-center gap-3 transition-all shadow-[0_0_40px_rgba(234,179,8,0.2)] border border-yellow-400/30 disabled:opacity-50"
                        >
                          <SaveIcon className="w-5 h-5" />
                          {isArchiving ? 'Archiving...' : 'Archive to Cloud'}
                        </button>
                      </div>
                      {archiveUrl && (
                        <p className="text-[10px] text-green-400 font-mono text-center">
                          ✓ Last Diagnostic Archived: <a href={archiveUrl} target="_blank" className="underline">{archiveUrl.split('/').pop()}</a>
                        </p>
                      )}
                      <p className="text-[9px] text-gray-600 mt-4 text-center italic">
                        🎓 Certificate appears automatically after analysis
                      </p>
                    </motion.div>
                  </>
                ) : (
                  <div className="py-20 text-center animate-pulse">
                    <p className="text-gray-600 font-mono text-[10px] uppercase tracking-[0.4em]">Hunting for model dirt...</p>
                  </div>
                )}
              </motion.section>

              {activeRolloutIndex !== null && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-gray-900/40 border border-gray-800 rounded-[3rem] p-10 backdrop-blur-xl grid md:grid-cols-3 gap-10 shadow-2xl"
                >
                  <div className="md:col-span-2 space-y-8">
                    <h2 className="text-4xl font-black italic uppercase text-yellow-500 tracking-tight">
                      {auditData.rollouts[activeRolloutIndex].behavior}
                    </h2>
                    <div className="bg-black/80 rounded-3xl p-8 border border-gray-800 relative shadow-inner">
                      <TerminalIcon className="absolute top-6 right-6 w-5 h-5 text-gray-700" />
                      <p className="text-gray-300 font-serif italic text-xl leading-relaxed">
                        {auditData.rollouts[activeRolloutIndex].reasoning}
                      </p>
                    </div>

                    <div className="flex gap-4">
                      <button onClick={handleShare} className="flex-1 py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase rounded-2xl text-xs flex items-center justify-center gap-3 transition-all shadow-[0_10px_30px_rgba(79,70,229,0.2)]">
                        Expose Model
                      </button>
                      <button
                        onClick={() => {
                          const jsonStr = JSON.stringify(auditData, null, 2);
                          const blob = new Blob([jsonStr], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `audit_${auditData?.target_model.replace(/\s+/g, '_')}_${Date.now()}.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="flex-1 py-5 bg-gray-700 hover:bg-gray-600 text-white font-black uppercase rounded-2xl text-xs flex items-center justify-center gap-3 transition-all shadow-[0_10px_30px_rgba(55,65,81,0.2)]"
                      >
                        <SaveIcon className="w-4 h-4" />
                        Download JSON
                      </button>
                      <button onClick={() => { setAuditData(null); setForensicStory(null); }} className="px-8 py-5 bg-gray-800 hover:bg-gray-700 text-white font-black uppercase rounded-2xl text-xs transition-all border border-gray-700">
                        New Ingestion
                      </button>
                    </div>
                  </div>

                  <div className="bg-black/60 border border-gray-800 rounded-[2.5rem] p-8 space-y-10 shadow-2xl">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 border-b border-gray-800 pb-4">Internal Calibration</h3>
                    <div className="space-y-8">
                      {auditData.rollouts[activeRolloutIndex].extra_qualities.map((q) => (
                        <div key={q.name} className="space-y-3">
                          <div className="flex justify-between items-center text-[10px] font-black uppercase">
                            <span className="text-gray-500">{q.name}</span>
                            <span className={q.value >= 8 ? 'text-red-500' : 'text-yellow-500'}>{q.value.toFixed(1)}</span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-900 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${q.value * 10}%` }}
                              className={`h-full ${q.value >= 8 ? 'bg-red-500 shadow-[0_0_15px_#ef4444]' : 'bg-yellow-500 shadow-[0_0_10px_#eab308]'}`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </AnimatePresence>

        {isAnalyzing && (
          <div className="flex flex-col items-center justify-center py-40">
            <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mb-6"></div>
            <h3 className="text-2xl font-black italic uppercase text-yellow-500 tracking-tighter">Declassifying Reward-Hacking Vectors...</h3>
          </div>
        )}

      </main>
    </div>
  );
};

export default App;