import { useEffect, useRef } from 'react';

interface VideoModalProps {
    show: boolean;
    onClose: () => void;
    stream: MediaStream | null;
    playerName: string;
    isMuted?: boolean;
    isLocal?: boolean;
}

export default function VideoModal({
    show,
    onClose,
    stream,
    playerName,
    isMuted = false,
    isLocal = false,
}: VideoModalProps) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && stream && show) {
            videoRef.current.srcObject = stream;
        }
    }, [stream, show]);

    // Close on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (show) {
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [show, onClose]);

    if (!show || !stream) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="relative max-w-4xl w-full mx-4 animate-scaleIn"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute -top-12 right-0 text-white/80 hover:text-white transition p-2"
                    title="Close (Esc)"
                >
                    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Video container */}
                <div className="relative rounded-2xl overflow-hidden bg-gray-900 shadow-2xl">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted={isLocal}
                        className={`w-full aspect-video object-cover ${isLocal ? 'scale-x-[-1]' : 'scale-x-[-1]'}`}
                    />

                    {/* Player name overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                        <div className="flex items-center justify-between">
                            <p className="text-white font-bold text-lg">
                                {playerName}
                                {isLocal && <span className="text-blue-400 ml-2">(You)</span>}
                            </p>
                            <div className="flex items-center gap-2">
                                {isMuted ? (
                                    <span className="flex items-center gap-1 text-red-400 text-sm">
                                        <MicOffIcon className="h-5 w-5" />
                                        Muted
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-green-400 text-sm">
                                        <MicOnIcon className="h-5 w-5" />
                                        Unmuted
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Maximize hint */}
                    <div className="absolute top-4 right-4">
                        <span className="bg-black/50 text-white/70 text-xs px-2 py-1 rounded">
                            Click outside or press Esc to close
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MicOnIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
    );
}

function MicOffIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
        </svg>
    );
}
