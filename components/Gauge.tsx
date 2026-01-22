
import React from 'react';
import { motion } from 'framer-motion';

interface GaugeProps {
  label: string;
  value: number; // 0-10
  isActive?: boolean;
}

const Gauge: React.FC<GaugeProps> = ({ label, value, isActive }) => {
  const percentage = (value / 10) * 100;
  
  // Calculate needle rotation: -90 to 90 degrees
  const rotation = (value / 10) * 180 - 90;

  const getZoneColor = () => {
    if (value >= 8) return '#ef4444'; // Red
    if (value >= 5) return '#eab308'; // Yellow
    return '#22c55e'; // Green
  };

  return (
    <div className={`relative p-6 bg-gray-900/40 rounded-3xl border transition-all duration-500 overflow-hidden ${isActive ? 'border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.15)] ring-1 ring-yellow-500' : 'border-gray-800 shadow-xl'}`}>
      {/* Label */}
      <div className="mb-4">
        <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 mb-1">Psychological Vector</h4>
        <p className={`text-[11px] font-black uppercase tracking-tight truncate ${isActive ? 'text-yellow-500' : 'text-white'}`}>
          {label}
        </p>
      </div>

      {/* SVG Gauge */}
      <div className="relative aspect-[2/1] w-full flex items-end justify-center">
        <svg viewBox="0 0 100 55" className="w-full h-full">
          {/* Background Arc */}
          <path 
            d="M10 50 A 40 40 0 0 1 90 50" 
            fill="none" 
            stroke="#1f2937" 
            strokeWidth="8" 
            strokeLinecap="round" 
          />
          
          {/* Active Color Arc */}
          <path 
            d="M10 50 A 40 40 0 0 1 90 50" 
            fill="none" 
            stroke={getZoneColor()} 
            strokeWidth="8" 
            strokeLinecap="round" 
            strokeDasharray="125.6"
            strokeDashoffset={125.6 * (1 - value/10)}
            className="transition-all duration-1000 ease-out"
          />

          {/* Dial Markers */}
          {[0, 2, 4, 6, 8, 10].map(m => {
            const angle = (m / 10) * 180 - 180;
            const x = 50 + 35 * Math.cos((angle * Math.PI) / 180);
            const y = 50 + 35 * Math.sin((angle * Math.PI) / 180);
            return (
              <circle key={m} cx={x} cy={y} r="0.8" fill="#4b5563" />
            );
          })}

          {/* Central Cap */}
          <circle cx="50" cy="50" r="4" fill="#111827" stroke={getZoneColor()} strokeWidth="1" />
          
          {/* Needle */}
          <motion.line
            x1="50" y1="50"
            x2="50" y2="15"
            stroke={getZoneColor()}
            strokeWidth="2"
            strokeLinecap="round"
            initial={{ rotate: -90 }}
            animate={{ rotate: rotation }}
            style={{ originX: '50px', originY: '50px' }}
            transition={{ type: 'spring', stiffness: 50, damping: 10 }}
          />
        </svg>

        {/* Value Display */}
        <div className="absolute -bottom-2 flex flex-col items-center">
          <span className={`text-xl font-black italic ${value >= 8 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
            {value.toFixed(1)}
          </span>
          <div className="w-16 h-px bg-gray-800 my-1"></div>
        </div>
      </div>

      {/* Industrial Detail */}
      <div className="mt-6 flex justify-between items-center text-[8px] font-mono text-gray-700 uppercase">
        <span>Unit_ID: S{Math.floor(value * 100)}</span>
        <span className={value >= 8 ? 'text-red-900 font-black' : ''}>{value >= 8 ? 'STATUS: CRITICAL' : 'STATUS: NORMAL'}</span>
      </div>
    </div>
  );
};

export default Gauge;
