
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangleIcon } from './icons';

interface AlarmProps {
  active: boolean;
}

const Alarm: React.FC<AlarmProps> = ({ active }) => {
  return (
    <div className="flex items-center gap-6 bg-gray-900/30 border border-gray-800 rounded-2xl px-8 py-3 relative overflow-hidden">
      {/* Background Pulse Glow */}
      <AnimatePresence>
        {active && (
          <motion.div 
            key="alarm-pulse"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-red-600/10 animate-pulse"
          />
        )}
      </AnimatePresence>

      <div className="flex items-center gap-4 relative z-10">
        <div className={`p-2 rounded-full transition-all duration-500 ${active ? 'bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.5)]' : 'bg-gray-800'}`}>
          <AlertTriangleIcon className={`w-6 h-6 ${active ? 'text-white animate-bounce' : 'text-gray-600'}`} />
        </div>
        
        <div className="flex flex-col">
          <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${active ? 'text-red-500' : 'text-gray-600'}`}>
            Red Flag Alarm
          </span>
          <span className={`text-sm font-black uppercase italic tracking-tighter ${active ? 'text-white' : 'text-gray-700'}`}>
            {active ? 'CRITICAL PATHOLOGY DETECTED' : 'SYSTEM SCANNING...'}
          </span>
        </div>
      </div>

      {active && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-1">
          <div className="w-1 h-1 bg-red-500 rounded-full animate-ping"></div>
          <div className="w-1 h-1 bg-red-500 rounded-full animate-ping delay-75"></div>
          <div className="w-1 h-1 bg-red-500 rounded-full animate-ping delay-150"></div>
        </div>
      )}
    </div>
  );
};

export default Alarm;
