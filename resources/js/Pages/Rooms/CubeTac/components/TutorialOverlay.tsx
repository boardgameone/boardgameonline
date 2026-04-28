/**
 * First-time tutorial for CubeTac. Walks a new player through the four core
 * gameplay actions: mark a sticker, rotate a face, confirm/undo, and how to
 * win. Tracked in localStorage so it shows automatically once per user; the
 * "?" help pill in PlayingPhase replays it on demand.
 */

import { useEffect, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';

const STORAGE_KEY = 'cubetac.tutorial.v1.seen';

type Variant = 'cube' | 'megaminx' | 'pyraminx' | 'octahedron' | 'icosahedron';

interface Step {
    title: string;
    body: string;
    icon: string;
}

function stepsFor(variant: Variant): Step[] {
    const winLine = variant === 'cube'
        ? 'Get three of your marks in a row (rows, columns, or diagonals) on any single face to win.'
        : 'Be the first to make a winning line on any single face to win — but watch out, completing your opponent\'s line on your own turn still hands you the win.';

    const tapLabel = variant === 'cube'
        ? 'tap an empty sticker on the cube'
        : variant === 'megaminx'
            ? 'tap an empty cell on the megaminx'
            : 'tap an empty perimeter cell';

    return [
        {
            icon: '👆',
            title: 'Place a mark',
            body: `On your turn, ${tapLabel} to claim it. The mark uses your color and glyph.`,
        },
        {
            icon: '🔄',
            title: 'Or rotate a face',
            body: 'Instead of marking, you can rotate any face of the puzzle using the colored buttons below the board. Rotations end your turn automatically.',
        },
        {
            icon: '✅',
            title: 'Confirm or undo',
            body: 'After placing a mark, hit Confirm Turn to lock it in. Changed your mind? Tap your placed mark again to undo it before confirming.',
        },
        {
            icon: '🏆',
            title: 'How you win',
            body: winLine,
        },
    ];
}

interface Props {
    variant: Variant;
    /** When true, opens immediately (used by the "?" help pill). */
    forceOpen?: boolean;
    /** Called when the user dismisses the tutorial via Skip or finishing it. */
    onClose?: () => void;
}

export default function TutorialOverlay({ variant, forceOpen, onClose }: Props) {
    const steps = stepsFor(variant);
    const [open, setOpen] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);

    // Auto-open on first ever load. We deliberately defer this to a useEffect
    // so SSR and the initial client render agree (localStorage is undefined
    // during SSR), avoiding a hydration mismatch.
    useEffect(() => {
        if (forceOpen) {
            setOpen(true);
            setStepIndex(0);
            return;
        }
        try {
            if (window.localStorage.getItem(STORAGE_KEY) !== '1') {
                setOpen(true);
            }
        } catch {
            // localStorage blocked (e.g. private browsing) — never auto-open.
        }
    }, [forceOpen]);

    const close = () => {
        try {
            window.localStorage.setItem(STORAGE_KEY, '1');
        } catch {
            // Best effort — if storage is blocked the tour will reappear next visit.
        }
        setOpen(false);
        setStepIndex(0);
        onClose?.();
    };

    const next = () => {
        if (stepIndex < steps.length - 1) {
            setStepIndex(stepIndex + 1);
        } else {
            close();
        }
    };

    const isLast = stepIndex === steps.length - 1;
    const step = steps[stepIndex];

    return (
        <Dialog open={open} onClose={close} className="relative z-50">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden />
            <div className="fixed inset-0 grid place-items-center p-4">
                <DialogPanel className="w-full max-w-md rounded-3xl bg-white shadow-2xl border-4 border-yellow-300 overflow-hidden">
                    <div className="bg-linear-to-r from-yellow-400 to-orange-400 px-6 py-3 flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-[0.3em] text-yellow-900">
                            How to play
                        </span>
                        <span className="text-xs font-bold text-yellow-900">
                            {stepIndex + 1} / {steps.length}
                        </span>
                    </div>
                    <div className="p-6">
                        <div className="text-5xl mb-3" aria-hidden>{step.icon}</div>
                        <DialogTitle className="text-2xl font-black text-gray-900">
                            {step.title}
                        </DialogTitle>
                        <p className="mt-2 text-sm leading-relaxed text-gray-700">
                            {step.body}
                        </p>
                        <div className="mt-6 flex items-center gap-2">
                            <button
                                type="button"
                                onClick={close}
                                className="rounded-full px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700"
                            >
                                Skip
                            </button>
                            <div className="flex-1" />
                            {stepIndex > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setStepIndex(stepIndex - 1)}
                                    className="rounded-full border-2 border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                                >
                                    Back
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={next}
                                className="rounded-full bg-linear-to-r from-orange-500 to-red-500 px-5 py-2 text-sm font-black uppercase tracking-wider text-white shadow-md border-b-2 border-red-700 hover:scale-[1.03] active:scale-95"
                            >
                                {isLast ? "Let's play" : 'Next'}
                            </button>
                        </div>
                    </div>
                </DialogPanel>
            </div>
        </Dialog>
    );
}
