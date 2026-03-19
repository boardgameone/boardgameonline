import { useState, useEffect } from 'react';

interface UseNightPhaseTimerResult {
    timeRemaining: number; // seconds remaining
    isExpired: boolean;
    percentage: number; // 0-100, how much time has elapsed
}

/**
 * Hook to manage the night phase timer countdown.
 * Calculates remaining time based on server timestamp to avoid drift.
 *
 * @param startedAt - ISO timestamp when the hour started (from server)
 * @param duration - Total duration in seconds (default 15)
 * @returns Timer state including remaining time, expiration status, and percentage
 */
export function useNightPhaseTimer(
    startedAt: string | null,
    duration: number = 15
): UseNightPhaseTimerResult {
    const [timeRemaining, setTimeRemaining] = useState<number>(duration);
    const [isExpired, setIsExpired] = useState<boolean>(false);
    const [percentage, setPercentage] = useState<number>(0);

    useEffect(() => {
        if (!startedAt) {
            setTimeRemaining(duration);
            setIsExpired(false);
            setPercentage(0);
            return;
        }

        const startTime = new Date(startedAt).getTime();

        const updateTimer = () => {
            const now = Date.now();
            const elapsed = (now - startTime) / 1000; // Convert to seconds
            const remaining = Math.max(0, duration - elapsed);
            const pct = Math.min(100, (elapsed / duration) * 100);

            setTimeRemaining(remaining);
            setPercentage(pct);
            setIsExpired(remaining <= 0);
        };

        // Initial update
        updateTimer();

        // Update every 100ms for smooth countdown
        const interval = setInterval(updateTimer, 100);

        return () => clearInterval(interval);
    }, [startedAt, duration]);

    return {
        timeRemaining,
        isExpired,
        percentage,
    };
}
