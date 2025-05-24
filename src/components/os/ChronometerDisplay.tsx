
'use client';

import React, { useState, useEffect } from 'react';
import { parseISO, differenceInSeconds, isValid } from 'date-fns';
import { Clock } from 'lucide-react';

interface ChronometerDisplayProps {
  startTimeISO?: string | null; // ISO string for when production started for the current session
  accumulatedSeconds?: number;  // Total seconds already spent in production from previous sessions
  isRunningClientOverride?: boolean; // Optional: to force display as running for optimistic UI
}

const formatDuration = (totalSeconds: number): string => {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export default function ChronometerDisplay({ startTimeISO, accumulatedSeconds = 0, isRunningClientOverride }: ChronometerDisplayProps) {
  const [displayTime, setDisplayTime] = useState<number>(accumulatedSeconds);
  const [isRunning, setIsRunning] = useState<boolean>(!!startTimeISO || !!isRunningClientOverride);

  useEffect(() => {
    setIsRunning(!!startTimeISO || !!isRunningClientOverride);
    // Reset displayTime to accumulated when startTimeISO changes (e.g., pause/play)
    // or when isRunningClientOverride changes.
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
        // If startTimeISO is invalid, just show accumulated time
        setDisplayTime(accumulatedSeconds);
        setIsRunning(false); // Stop trying to run if start date is bad
      }
    } else {
      // Not running or no valid start time, just show accumulated time
      setDisplayTime(accumulatedSeconds);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isRunning, startTimeISO, accumulatedSeconds]);

  return (
    <div className="d-flex align-items-center text-muted small">
      <Clock size={14} className={`me-1 flex-shrink-0 ${isRunning ? 'text-primary' : 'text-secondary'}`} />
      <span className={`fw-medium ${isRunning ? 'text-primary' : 'text-secondary'}`} title="Tempo em produção">
        {formatDuration(displayTime)}
      </span>
    </div>
  );
}
