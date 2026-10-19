/**
 * Surfaces rejected-move errors (`back()->withErrors(['error' => …])` from
 * CubeTacGameController) as a short-lived toast with an error sound. The
 * error bag only lives for one response, so each rejection shows once.
 */

import { usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { useSfx } from '@/lib/sfx';

const VISIBLE_MS = 3000;

export default function ActionToast() {
    const { errors } = usePage().props as { errors?: Record<string, string> };
    const error = errors?.error;
    const [message, setMessage] = useState<string | null>(null);
    const { play } = useSfx();

    useEffect(() => {
        if (!error) return;
        setMessage(error);
        play('UI_ERROR');
        const timer = window.setTimeout(() => setMessage(null), VISIBLE_MS);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [error]);

    if (!message) return null;

    return (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-40 flex justify-center px-4" role="status" aria-live="assertive">
            <div className="pointer-events-auto inline-flex max-w-sm items-center gap-2 rounded-full border-2 border-red-200 bg-white/90 px-4 py-2 text-sm font-bold text-red-700 shadow-lg backdrop-blur-xs motion-safe:animate-shake dark:border-red-800/60 dark:bg-gray-900/90 dark:text-red-300">
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
                </svg>
                <span>{message}</span>
                <button
                    type="button"
                    onClick={() => setMessage(null)}
                    className="ml-1 rounded-full p-0.5 text-red-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/40"
                    aria-label="Dismiss"
                >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.6} viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
