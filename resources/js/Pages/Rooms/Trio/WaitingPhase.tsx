import { router } from '@inertiajs/react';
import { useState } from 'react';
import TutorialModal from './components/TutorialModal';

interface Player {
    id: number;
    nickname: string;
    avatar_color: string;
    is_host: boolean;
    is_connected: boolean;
}

interface WaitingPhaseProps {
    roomCode: string;
    gameSlug: string;
    players: Player[];
    isHost: boolean;
    minPlayers: number;
    maxPlayers: number;
}

export default function WaitingPhase({
    roomCode,
    gameSlug,
    players,
    isHost,
    minPlayers,
    maxPlayers,
}: WaitingPhaseProps) {
    const [showTutorial, setShowTutorial] = useState(false);
    const connectedPlayers = players.filter((p) => p.is_connected);
    const canStart = connectedPlayers.length >= minPlayers;

    const handleStart = () => {
        router.post(route('rooms.trio.start', [gameSlug, roomCode]));
    };

    return (
        <div className="rounded-xl bg-white p-8 shadow-lg">
            {/* Header with help button */}
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">
                    Waiting Room
                </h3>
                <button
                    onClick={() => setShowTutorial(true)}
                    className="rounded-lg bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-200 transition"
                >
                    📖 How to Play
                </button>
            </div>

            {/* Game rules summary */}
            <div className="mb-6 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border border-blue-200">
                <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                    <span className="text-2xl">🎴</span>
                    Game Rules
                </h4>
                <ul className="space-y-2 text-sm text-blue-800">
                    <li className="flex items-start gap-2">
                        <span className="text-blue-500 font-bold">1.</span>
                        <span>Reveal cards from the middle grid or ask players for their highest/lowest card</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-blue-500 font-bold">2.</span>
                        <span>Collect 3 matching cards to claim a trio</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-blue-500 font-bold">3.</span>
                        <span>First player to collect 3 trios wins!</span>
                    </li>
                </ul>
            </div>

            {/* Players list */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-gray-700">
                        Players ({connectedPlayers.length}/{maxPlayers})
                    </h4>
                    {!canStart && (
                        <span className="text-sm text-amber-600 font-medium">
                            Need {minPlayers - connectedPlayers.length} more player{minPlayers - connectedPlayers.length !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                    {connectedPlayers.map((player, index) => (
                        <div
                            key={player.id}
                            className="flex items-center gap-3 rounded-lg border-2 border-gray-200 bg-white p-4 animate-slideIn"
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
                            <div
                                className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md animate-pulse"
                                style={{
                                    backgroundColor: player.avatar_color,
                                    animationDelay: `${index * 200}ms`,
                                }}
                            >
                                {player.nickname.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 truncate">
                                    {player.nickname}
                                </p>
                                {player.is_host && (
                                    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800">
                                        👑 Host
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Start button for host */}
            {isHost && (
                <button
                    onClick={handleStart}
                    disabled={!canStart}
                    className="w-full rounded-xl bg-gradient-to-r from-green-500 to-green-600 px-6 py-4 text-lg font-black text-white shadow-lg hover:from-green-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 active:scale-95 disabled:hover:scale-100 border-b-4 border-green-700 disabled:border-gray-600"
                >
                    {canStart ? '🎮 Start Game!' : `Need ${minPlayers} players to start`}
                </button>
            )}

            {/* Tutorial Modal */}
            <TutorialModal show={showTutorial} onClose={() => setShowTutorial(false)} />
        </div>
    );
}
