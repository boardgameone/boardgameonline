import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import TrioCard from './components/TrioCard';

interface Player {
    id: number;
    nickname: string;
    avatar_color: string;
    collected_trios: number[][];
    trios_count: number;
}

interface FinishedPhaseProps {
    roomCode: string;
    gameSlug: string;
    players: Player[];
    winner: string | null;
}

export default function FinishedPhase({ roomCode, gameSlug, players, winner }: FinishedPhaseProps) {
    const [confettiPieces, setConfettiPieces] = useState<Array<{ id: number; left: number; delay: number; color: string }>>([]);

    useEffect(() => {
        // Generate confetti
        const pieces = Array.from({ length: 50 }, (_, i) => ({
            id: i,
            left: Math.random() * 100,
            delay: Math.random() * 1,
            color: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'][Math.floor(Math.random() * 6)],
        }));
        setConfettiPieces(pieces);

        // Haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
        }
    }, []);

    const sortedPlayers = [...players].sort((a, b) => b.trios_count - a.trios_count);
    const winningPlayer = players.find(p => p.trios_count >= 3);

    const handlePlayAgain = () => {
        router.post(route('rooms.resetGame', [gameSlug, roomCode]));
    };

    const handleNewRoom = () => {
        router.visit(route('games.show', gameSlug));
    };

    return (
        <div className="relative overflow-hidden">
            {/* Confetti background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                {confettiPieces.map((piece) => (
                    <div
                        key={piece.id}
                        className="absolute w-3 h-3 animate-confetti"
                        style={{
                            left: `${piece.left}%`,
                            top: '-10px',
                            backgroundColor: piece.color,
                            animationDelay: `${piece.delay}s`,
                            animationDuration: '4s',
                        }}
                    />
                ))}
            </div>

            {/* Winner celebration */}
            <div className="relative z-10 space-y-6">
                <div className="rounded-2xl bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-500 p-10 text-center shadow-2xl border-4 border-yellow-600 animate-slideIn">
                    <div className="text-8xl mb-4 animate-bounce">🏆</div>
                    <h1 className="text-5xl font-black text-yellow-900 mb-3">
                        {winningPlayer?.nickname} Wins!
                    </h1>
                    <p className="text-2xl text-yellow-800 font-bold">
                        Collected 3 trios! 🎉
                    </p>

                    {/* Winner avatar */}
                    {winningPlayer && (
                        <div className="mt-6 flex justify-center">
                            <div
                                className="h-24 w-24 rounded-full flex items-center justify-center text-white font-black text-4xl shadow-2xl ring-8 ring-yellow-200 animate-pulse"
                                style={{ backgroundColor: winningPlayer.avatar_color }}
                            >
                                {winningPlayer.nickname.charAt(0).toUpperCase()}
                            </div>
                        </div>
                    )}
                </div>

                {/* Final scores */}
                <div className="rounded-xl bg-white p-6 shadow-lg">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">
                        Final Scores
                    </h2>
                    <div className="space-y-3">
                        {sortedPlayers.map((player, index) => (
                            <div
                                key={player.id}
                                className={`rounded-lg p-4 border-2 transition-all animate-slideIn ${
                                    index === 0
                                        ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-400'
                                        : 'bg-gray-50 border-gray-200'
                                }`}
                                style={{ animationDelay: `${index * 100}ms` }}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {/* Rank */}
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                            index === 0 ? 'bg-yellow-500 text-white' :
                                            index === 1 ? 'bg-gray-400 text-white' :
                                            index === 2 ? 'bg-orange-600 text-white' :
                                            'bg-gray-300 text-gray-700'
                                        }`}>
                                            {index + 1}
                                        </div>

                                        {/* Avatar */}
                                        <div
                                            className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold shadow-md"
                                            style={{ backgroundColor: player.avatar_color }}
                                        >
                                            {player.nickname.charAt(0).toUpperCase()}
                                        </div>

                                        {/* Name and score */}
                                        <div>
                                            <p className="font-bold text-gray-900">
                                                {player.nickname}
                                                {index === 0 && ' 👑'}
                                            </p>
                                            <p className="text-sm text-gray-600 font-semibold">
                                                {player.trios_count} trio{player.trios_count !== 1 ? 's' : ''}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Show collected trios */}
                                {player.collected_trios.length > 0 && (
                                    <div className="mt-3 flex gap-3 flex-wrap">
                                        {player.collected_trios.map((trio, idx) => (
                                            <div key={idx} className="flex gap-1">
                                                {trio.map((card, cardIdx) => (
                                                    <TrioCard
                                                        key={cardIdx}
                                                        value={card}
                                                        faceUp={true}
                                                        size="sm"
                                                        variant="green"
                                                    />
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <button
                        onClick={handlePlayAgain}
                        className="rounded-xl bg-gradient-to-r from-green-500 to-green-600 px-6 py-4 text-lg font-black text-white shadow-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 hover:scale-105 active:scale-95 border-b-4 border-green-700"
                    >
                        🔄 Play Again
                    </button>
                    <button
                        onClick={handleNewRoom}
                        className="rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 text-lg font-black text-white shadow-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 hover:scale-105 active:scale-95 border-b-4 border-blue-700"
                    >
                        🏠 New Room
                    </button>
                </div>
            </div>
        </div>
    );
}
