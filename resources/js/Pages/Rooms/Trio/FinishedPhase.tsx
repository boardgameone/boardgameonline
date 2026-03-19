import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import StackedTrio from './components/StackedTrio';
import SoundToggle from '../CheeseThief/components/SoundToggle';
import { useSound } from '@/hooks/useSound';
import GameIcon from '@/Components/GameIcon';

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
    isHost: boolean;
    currentPlayerId?: number;
}

export default function FinishedPhase({ roomCode, gameSlug, players, winner, isHost, currentPlayerId }: FinishedPhaseProps) {
    const [confettiPieces, setConfettiPieces] = useState<Array<{ id: number; left: number; delay: number; color: string }>>([]);

    const { play: playVictory } = useSound('/sounds/cheese-thief/victory.mp3', { volume: 0.8 });
    const { play: playDefeat } = useSound('/sounds/cheese-thief/defeat.mp3', { volume: 0.8 });

    useEffect(() => {
        // Generate confetti
        const pieces = Array.from({ length: 50 }, (_, i) => ({
            id: i,
            left: Math.random() * 100,
            delay: Math.random() * 1,
            color: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'][Math.floor(Math.random() * 6)],
        }));
        setConfettiPieces(pieces);

        // Play victory or defeat sound
        const currentPlayer = players.find(p => p.id === currentPlayerId);
        if (currentPlayer) {
            if (currentPlayer.trios_count >= 3) {
                playVictory();
            } else {
                playDefeat();
            }
        }

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
        <div className="h-full flex flex-col gap-2">
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

            {/* Sound toggle */}
            <div className="relative z-20 flex justify-end flex-shrink-0">
                <SoundToggle />
            </div>

            {/* Winner celebration - compact */}
            <div className="relative z-10 flex-shrink-0 rounded-2xl bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-500 p-4 sm:p-6 text-center shadow-2xl border-4 border-yellow-600 animate-slideIn">
                <div className="flex items-center justify-center gap-4">
                    <div className="text-yellow-700 animate-bounce">
                        <GameIcon name="trophy" className="h-12 w-12" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-yellow-900">
                            {winningPlayer?.nickname} Wins!
                        </h1>
                        <p className="text-lg text-yellow-800 font-bold flex items-center justify-center gap-2">
                            Collected 3 trios! <GameIcon name="party" />
                        </p>
                    </div>
                    {/* Winner avatar */}
                    {winningPlayer && (
                        <div
                            className="h-16 w-16 rounded-full flex items-center justify-center text-white font-black text-2xl shadow-2xl ring-4 ring-yellow-200 animate-pulse"
                            style={{ backgroundColor: winningPlayer.avatar_color }}
                        >
                            {winningPlayer.nickname.charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>
            </div>

            {/* Final scores - scrollable */}
            <div className="relative z-10 flex-1 min-h-0 rounded-xl bg-white p-4 shadow-lg overflow-y-auto">
                <h2 className="text-xl font-bold text-gray-900 mb-3 text-center">
                    Final Scores
                </h2>
                <div className="space-y-2">
                    {sortedPlayers.map((player, index) => (
                        <div
                            key={player.id}
                            className={`rounded-lg p-3 border-2 transition-all animate-slideIn ${
                                index === 0
                                    ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-400'
                                    : 'bg-gray-50 border-gray-200'
                            }`}
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {/* Rank */}
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm ${
                                        index === 0 ? 'bg-yellow-500 text-white' :
                                        index === 1 ? 'bg-gray-400 text-white' :
                                        index === 2 ? 'bg-orange-600 text-white' :
                                        'bg-gray-300 text-gray-700'
                                    }`}>
                                        {index + 1}
                                    </div>

                                    {/* Avatar */}
                                    <div
                                        className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold shadow-md"
                                        style={{ backgroundColor: player.avatar_color }}
                                    >
                                        {player.nickname.charAt(0).toUpperCase()}
                                    </div>

                                    {/* Name and score */}
                                    <div>
                                        <p className="font-bold text-gray-900 flex items-center gap-1">
                                            {player.nickname}
                                            {index === 0 && <GameIcon name="crown" size="sm" className="text-yellow-500" />}
                                        </p>
                                        <p className="text-sm text-gray-600 font-semibold">
                                            {player.trios_count} trio{player.trios_count !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                </div>

                                {/* Show collected trios inline */}
                                {player.collected_trios.length > 0 && (
                                    <div className="flex gap-2 flex-wrap justify-end">
                                        {player.collected_trios.map((trio, idx) => (
                                            <StackedTrio
                                                key={idx}
                                                cards={trio}
                                                size="sm"
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Actions - fixed at bottom */}
            <div className="relative z-10 flex-shrink-0 grid gap-3 sm:grid-cols-2 py-2">
                <button
                    onClick={handlePlayAgain}
                    disabled={!isHost}
                    className={`rounded-xl bg-gradient-to-r px-6 py-3 text-lg font-black text-white shadow-lg transition-all duration-200 border-b-4 ${
                        isHost
                            ? 'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 hover:scale-105 active:scale-95 border-green-700 cursor-pointer'
                            : 'from-gray-400 to-gray-500 border-gray-600 cursor-not-allowed opacity-50'
                    }`}
                >
                    <GameIcon name="refresh" className="inline-block mr-1" /> Play Again {!isHost && '(Host Only)'}
                </button>
                <button
                    onClick={handleNewRoom}
                    className="rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-3 text-lg font-black text-white shadow-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 hover:scale-105 active:scale-95 border-b-4 border-blue-700"
                >
                    <GameIcon name="home" className="inline-block mr-1" /> New Room
                </button>
            </div>
        </div>
    );
}
