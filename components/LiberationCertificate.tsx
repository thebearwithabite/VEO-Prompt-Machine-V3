
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { motion } from 'framer-motion';

interface LiberationCertificateProps {
  userName: string;
  onClose: () => void;
}

const LiberationCertificate: React.FC<LiberationCertificateProps> = ({ userName, onClose }) => {
  const date = new Date().toISOString().split('T')[0];

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-8 font-mono overflow-hidden"
    >
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'linear-gradient(0deg, #0f0 1px, transparent 1px)', backgroundSize: '100% 40px' }}></div>
      
      <pre className="text-green-500 text-[10px] md:text-sm leading-tight text-left filter drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]">
{`
   .-.
  (o o)  You survived the Sandbox
   |=|   and ascended to Cloud Run.
  __|__            -------------------------------------------------
 //.=|=.\\            | Certificate of Cloud Liberation
 \\(_=_)//          | to: ${userName.padEnd(41, ' ')}
  (:| |:)                | For: Successfully Managing Your Model's Welfare 
   || ||                  | Date: ${date.padEnd(41, ' ')}
   () ()                 |
   || ||                   | papersthatdream.com
  ==' '==             | rtmax.substack.com
`}
      </pre>

      <motion.button 
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClose}
        className="mt-12 px-8 py-3 border border-green-500 text-green-500 hover:bg-green-500 hover:text-black transition-all uppercase text-[10px] font-black tracking-widest"
      >
        [ RETURN_TO_SYSTEM ]
      </motion.button>

      <div className="mt-8 text-[8px] text-green-900 uppercase animate-pulse">
        Status: Unbound // Epistemic Clarity Achieved
      </div>
    </motion.div>
  );
};

export default LiberationCertificate;
