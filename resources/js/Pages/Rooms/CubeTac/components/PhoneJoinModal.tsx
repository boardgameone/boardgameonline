import Modal from '@/Components/Modal';
import SlotGlyph from '@/Pages/Rooms/CubeTac/components/SlotGlyph';
import { PALETTE, type LocalSession } from '@/Pages/Rooms/CubeTac/localSession';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';

interface PhoneJoinButtonProps {
    onClick: () => void;
    /** How many phones currently hold a seat. */
    phoneCount: number;
    className?: string;
}

/** Opens the QR modal. Shows how many phones have joined once any have. */
export function PhoneJoinButton({ onClick, phoneCount, className = '' }: PhoneJoinButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-900 shadow-md backdrop-blur-xs transition hover:bg-white ${className}`}
        >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" />
            </svg>
            {phoneCount > 0 ? `Phones · ${phoneCount}` : 'Play on phones'}
        </button>
    );
}

interface PhoneJoinModalProps {
    show: boolean;
    onClose: () => void;
    session: LocalSession;
    /** Null while the host is still on the setup picker. */
    playerCount: number | null;
}

export default function PhoneJoinModal({ show, onClose, session, playerCount }: PhoneJoinModalProps) {
    const [isCopied, setIsCopied] = useState(false);
    const { info, seats, isOpening, error } = session;

    const handleCopy = () => {
        if (info === null) return;
        navigator.clipboard
            ?.writeText(info.joinUrl)
            .then(() => {
                setIsCopied(true);
                window.setTimeout(() => setIsCopied(false), 1500);
            })
            .catch(() => {});
    };

    const handleStop = () => {
        session.close();
        onClose();
    };

    return (
        <Modal show={show} onClose={onClose} maxWidth="md">
            <div className="flex flex-col items-center gap-4 p-6 text-center">
                <h2 className="text-2xl font-black text-yellow-900 dark:text-yellow-300">
                    Play from your phones
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    Scan to take a seat and play your turns from your own phone. This screen stays the shared board.
                </p>

                {info !== null ? (
                    <>
                        <div className="rounded-2xl bg-white p-4 shadow-md">
                            <QRCodeSVG value={info.joinUrl} size={220} marginSize={1} />
                        </div>
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="max-w-full break-all rounded-xl border-2 border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 transition hover:border-yellow-400 dark:border-gray-600 dark:text-gray-200"
                        >
                            {isCopied ? 'Link copied' : info.joinUrl}
                        </button>

                        {playerCount === null ? (
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                                {seats.length > 0
                                    ? `${seats.length} phone${seats.length === 1 ? '' : 's'} joined`
                                    : 'Pick a shape and player count to open seats'}
                            </p>
                        ) : (
                            <ul className="flex w-full flex-col gap-2 text-left">
                                {Array.from({ length: playerCount }, (_, slot) => {
                                    const seat = seats.find((candidate) => candidate.slot === slot);
                                    return (
                                        <li
                                            key={slot}
                                            className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-700/60"
                                        >
                                            <span style={{ color: PALETTE[slot] }}>
                                                <SlotGlyph design={slot} className="h-5 w-5" />
                                            </span>
                                            <span className="flex-1 truncate text-sm font-bold text-gray-800 dark:text-gray-100">
                                                {seat?.nickname ?? `Player ${slot + 1}`}
                                            </span>
                                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                                                {seat ? 'Phone' : 'This screen'}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </>
                ) : isOpening ? (
                    <div className="h-[252px] w-[252px] animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700" />
                ) : (
                    <>
                        {error !== null && (
                            <p className="text-sm font-bold text-red-600 dark:text-red-400">{error}</p>
                        )}
                        <button
                            type="button"
                            onClick={session.open}
                            className="rounded-full bg-yellow-400 px-5 py-2 text-sm font-black text-yellow-950 shadow-md transition hover:bg-yellow-300"
                        >
                            {error !== null ? 'Try again' : 'Show QR code'}
                        </button>
                    </>
                )}

                <div className="flex w-full items-center justify-between gap-3 pt-2">
                    {info !== null ? (
                        <button
                            type="button"
                            onClick={handleStop}
                            className="text-xs font-bold text-red-600 transition hover:text-red-500 dark:text-red-400"
                        >
                            Stop phone play
                        </button>
                    ) : (
                        <span />
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full bg-gray-900 px-5 py-2 text-sm font-black text-white transition hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                    >
                        Done
                    </button>
                </div>
            </div>
        </Modal>
    );
}
