import { useEffect, useState } from 'react';
import Modal from '@/Components/Modal';
import TrioCard from './TrioCard';

interface TrioCelebrationProps {
    show: boolean;
    playerName: string;
    trioCards: number[];
    onClose: () => void;
}

export default function TrioCelebration({ show, playerName, trioCards, onClose }: TrioCelebrationProps) {
    const [confettiPieces, setConfettiPieces] = useState<Array<{ id: number; left: number; delay: number; color: string }>>([]);

    useEffect(() => {
        if (show) {
            // Generate confetti pieces
            const pieces = Array.from({ length: 40 }, (_, i) => ({
                id: i,
                left: Math.random() * 100,
                delay: Math.random() * 0.5,
                color: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'][Math.floor(Math.random() * 6)],
            }));
            setConfettiPieces(pieces);

            // Auto-dismiss after 2.5 seconds
            const timer = setTimeout(() => {
                onClose();
            }, 2500);

            return () => clearTimeout(timer);
        }
    }, [show, onClose]);

    return (
        <Modal show={show} onClose={onClose} maxWidth="md">
            <div className="relative overflow-hidden bg-gradient-to-br from-green-400 via-green-500 to-green-600 p-8 text-center rounded-lg">
                {/* Confetti */}
                {confettiPieces.map((piece) => (
                    <div
                        key={piece.id}
                        className="absolute w-3 h-3 animate-confetti"
                        style={{
                            left: `${piece.left}%`,
                            top: '-10px',
                            backgroundColor: piece.color,
                            animationDelay: `${piece.delay}s`,
                        }}
                    />
                ))}

                {/* Content */}
                <div className="relative z-10">
                    <div className="text-6xl mb-4 animate-bounce">🎉</div>
                    <h2 className="text-3xl font-black text-white mb-2">TRIO!</h2>
                    <p className="text-xl text-green-100 mb-6 font-bold">
                        {playerName} claimed a trio!
                    </p>

                    {/* Show trio cards */}
                    <div className="flex gap-4 justify-center mb-4">
                        {trioCards.map((card, idx) => (
                            <div
                                key={idx}
                                className="animate-slideIn"
                                style={{ animationDelay: `${idx * 100}ms` }}
                            >
                                <TrioCard
                                    value={card}
                                    faceUp={true}
                                    size="lg"
                                    variant="green"
                                />
                            </div>
                        ))}
                    </div>

                    <p className="text-green-100 text-sm font-medium">
                        Auto-closing...
                    </p>
                </div>
            </div>
        </Modal>
    );
}
