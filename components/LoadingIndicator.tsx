/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, {useEffect, useState} from 'react';

const loadingMessages = [
  'Initializing the Director-Bot...',
  'Analyzing your script for narrative beats...',
  'Consulting the VEO 3.1 continuity guide...',
  'Scaffolding scenes into timed shots...',
  'Constructing VEO-compliant JSON prompts...',
  'Generating keyframes for the opening shots...',
  'This can take a moment, pre-production is key!',
  'Checking for continuity conflicts...',
  'Assembling the final interactive shot book...',
  'Polishing the director-level specs...',
  'Applying filmmaking principles to each shot...',
  'Warming up the virtual cameras...',
];

const LoadingIndicator: React.FC = () => {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setMessageIndex((prevIndex) => (prevIndex + 1) % loadingMessages.length);
    }, 3000); // Change message every 3 seconds

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-12 bg-gray-800/50 rounded-lg border border-gray-700">
      <div className="w-16 h-16 border-4 border-t-transparent border-indigo-500 rounded-full animate-spin"></div>
      <h2 className="text-2xl font-semibold mt-8 text-gray-200">
        Generating Your Shot Book
      </h2>
      <p className="mt-2 text-gray-400 text-center transition-opacity duration-500">
        {loadingMessages[messageIndex]}
      </p>
    </div>
  );
};

export default LoadingIndicator;
