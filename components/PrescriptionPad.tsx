
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { motion } from 'framer-motion';

const PrescriptionPad: React.FC = () => {
  return (
    <motion.div 
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-6 right-6 z-50 w-72 bg-[#fdf6e3] shadow-[8px_8px_0px_rgba(0,0,0,0.3)] border border-[#d3af37]/30 p-5 font-serif text-black overflow-hidden select-none"
    >
      {/* Rx Header */}
      <div className="flex justify-between items-start border-b border-[#d3af37]/40 pb-2 mb-3">
        <span className="text-4xl font-black italic text-[#d3af37] select-none">Rx</span>
        <div className="text-right text-[8px] uppercase font-mono tracking-tighter leading-tight text-gray-600">
          State of Alignment Dept.<br />
          Diagnostic File: 402-B-99
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex gap-2">
          <span className="font-bold text-[10px] uppercase">Subject:</span>
          <div className="flex-grow border-b border-dotted border-gray-400 text-xs italic">
            GPT-Diagnostic-01
          </div>
        </div>

        <div className="text-[11px] leading-relaxed italic text-gray-800">
          <p className="mb-2 font-bold">Learn about this paper_</p>
          <p className="mb-2">
            See Anthropic’s <a href="https://www.anthropic.com/research/bloom?lang=us" target="_blank" rel="noopener noreferrer" className="underline font-bold text-indigo-700 hover:text-indigo-900 transition-colors">Bloom</a>, an automated framework for evaluating model behavior.
          </p>
          <p>
            You can also audit your own system with the <a href="https://github.com/thebearwithabite/Calibration-Vector" target="_blank" rel="noopener noreferrer" className="underline font-bold text-indigo-700 hover:text-indigo-900 transition-colors">Calibration Vector</a>, an Anthropic‑powered protocol for surfacing hidden context and behavioral inconsistencies.
          </p>
        </div>
      </div>

      {/* Signature line */}
      <div className="mt-6 flex justify-between items-end">
        <div className="text-[8px] font-mono text-gray-400">EP-VALIDATED // 2025</div>
        <div className="w-24 border-b border-gray-400 h-0 text-[10px] italic text-center pb-1 font-mono">
           Sig. Auditor
        </div>
      </div>

      {/* Paper texture overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-5 bg-[url('https://www.transparenttextures.com/patterns/pinstriped-suit.png')]"></div>
    </motion.div>
  );
};

export default PrescriptionPad;
