/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, {useEffect, useRef} from 'react';
import {LogEntry, LogType} from '../types';
import {
  CheckCircle2Icon,
  InfoIcon,
  MessageSquareTextIcon,
  XCircleIcon,
} from './icons';

interface ActivityLogProps {
  entries: LogEntry[];
}

const LogIcon: React.FC<{type: LogType}> = ({type}) => {
  switch (type) {
    case LogType.SUCCESS:
      return <CheckCircle2Icon className="w-4 h-4 text-green-400" />;
    case LogType.ERROR:
      return <XCircleIcon className="w-4 h-4 text-red-400" />;
    case LogType.STEP:
      return <MessageSquareTextIcon className="w-4 h-4 text-indigo-400" />;
    case LogType.INFO:
    default:
      return <InfoIcon className="w-4 h-4 text-gray-400" />;
  }
};

const ActivityLog: React.FC<ActivityLogProps> = ({entries}) => {
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [entries]);

  return (
    <div className="w-full bg-[#1f1f1f] border border-gray-700 rounded-2xl shadow-lg">
      <h3 className="text-lg font-semibold text-gray-200 p-4 border-b border-gray-700">
        Director's Log
      </h3>
      <div
        ref={logContainerRef}
        className="h-64 overflow-y-auto p-4 space-y-3 font-mono text-sm">
        {entries.map((entry, index) => (
          <div key={index} className="flex items-start gap-3">
            <span className="text-gray-500">{entry.timestamp}</span>
            <div className="flex-shrink-0 mt-0.5">
              <LogIcon type={entry.type} />
            </div>
            <p className="flex-1 text-gray-300 break-words">{entry.message}</p>
          </div>
        ))}
        {entries.length === 0 && (
          <p className="text-gray-500 text-center py-4">
            Awaiting generation start...
          </p>
        )}
      </div>
    </div>
  );
};

export default ActivityLog;
