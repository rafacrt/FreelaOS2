
'use client';

import React, { useState, useEffect } from 'react';
import { parseISO, differenceInSeconds, isValid } from 'date-fns';
import { Clock } from 'lucide-react';

interface ChronometerDisplayProps {
  startTimeISO?: string | null;
  accumulatedSeconds?: number;
  isRunningClientOverride?: boolean;
  osStatus?: string; // Pass OS status to control display for finalized OS
}

const formatDurationHHMMSS = (totalSeconds: number): string => {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const formatDurationVerbose = (totalSeconds: number): string => {
  if (isNaN(totalSeconds) || totalSeconds < 0) return 'N/D';
  if (totalSeconds === 0) return '0 segundos';

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} hora${hours > 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minuto${minutes > 1 ? 's' : ''}`);
  if (seconds > 0) parts.push(`${seconds} segundo${seconds > 1 ? 's' : ''}`);
  
  if (parts.length === 0) return '0 segundos'; // Should not happen if totalSeconds > 0

  let verboseString = parts.join(', ');
  // Replace last comma with 'e' if more than one part
  const lastCommaIndex = verboseString.lastIndexOf(',');
  if (lastCommaIndex !== -1 && parts.length > 1) {
    verboseString = verboseString.substring(0, lastCommaIndex) + ' e' + verboseString.substring(lastCommaIndex + 1);
  }
  
  return verboseString;
};


export default function ChronometerDisplay({ startTimeISO, accumulatedSeconds = 0, isRunningClientOverride, osStatus }: ChronometerDisplayProps) {
  const [displayTime, setDisplayTime] = useState<number>(accumulatedSeconds);
  const [isRunning, setIsRunning] = useState<boolean>(!!startTimeISO || !!isRunningClientOverride);

  useEffect(() => {
    setIsRunning(!!startTimeISO || !!isRunningClientOverride);
    setDisplayTime(accumulatedSeconds);
  }, [startTimeISO, accumulatedSeconds, isRunningClientOverride]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;

    if (isRunning && startTimeISO) {
      const startDate = parseISO(startTimeISO);
      if (isValid(startDate)) {
        intervalId = setInterval(() => {
          const now = new Date();
          const currentSessionSeconds = differenceInSeconds(now, startDate);
          setDisplayTime(accumulatedSeconds + currentSessionSeconds);
        }, 1000);
      } else {
        setDisplayTime(accumulatedSeconds);
        setIsRunning(false);
      }
    } else {
      setDisplayTime(accumulatedSeconds);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isRunning, startTimeISO, accumulatedSeconds]);

  // If OS is finalized, just show the accumulated time without the "running" icon state.
  const effectiveIsRunning = osStatus === 'Finalizado' ? false : isRunning;

  return (
    <div className="d-flex align-items-center text-muted small">
      <Clock size={14} className={`me-1 flex-shrink-0 ${effectiveIsRunning ? 'text-primary' : 'text-secondary'}`} />
      <strong className={`fw-bold me-1 ${effectiveIsRunning ? 'text-primary' : 'text-secondary'}`} title="Tempo em produção (HH:MM:SS)">
        {formatDurationHHMMSS(displayTime)}
      </strong>
      <span className="text-muted fst-italic" style={{ fontSize: '0.9em' }}>
        ({formatDurationVerbose(displayTime)})
      </span>
    </div>
  );
}
