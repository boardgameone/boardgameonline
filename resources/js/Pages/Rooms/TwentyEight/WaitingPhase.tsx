import { router } from '@inertiajs/react';
import { useState } from 'react';
import TwentyEightTutorial from './components/TwentyEightTutorial';
import GameIcon from '@/Components/GameIcon';
import PlayerCard from '@/Components/PlayerCard';
import { TwentyEightPlayer } from '@/types';

interface WaitingPhaseProps {
    roomCode: string;
    gameSlug: string;
    players: TwentyEightPlayer[];
    isHost: boolean;
    currentPlayerId?: number;
    minPlayers: number;
    maxPlayers: number;
}

export default function WaitingPhase({
    roomCode,
    gameSlug,
    players,
    isHost,
    currentPlayerId,
    minPlayers,
    maxPlayers,
}: WaitingPhaseProps) {
    const [showTutorial, setShowTutorial] = useState(false);
    const connectedPlayers = players.filter((p) => p.is_connected);
    const canStart = connectedPlayers.length >= minPlayers;

    const handleStart = () => {
        router.post(route('rooms.twentyEight.start', [gameSlug, roomCode]));
    };

    return (
        <div className="rounded-xl bg-white p-8 shadow-lg dark:bg-gray-800">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    Waiting Room
                </h3>
                <button
                    onClick={() => setShowTutorial(true)}
                    className="rounded-lg bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-200 transition dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/60"
                >
                    <GameIcon name="book" className="inline-block mr-1" /> How to Play
                </button>
            </div>

            {/* Game rules summary */}
            <div className="mb-6 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 p-6 border border-amber-200 dark:from-amber-900/20 dark:to-orange-900/20 dark:border-amber-800">
                <h4 className="font-bold text-amber-900 mb-3 flex items-center gap-2 dark:text-amber-200">
                    <GameIcon name="card" size="lg" className="text-amber-600 dark:text-amber-300" />
                    Twenty-Eight
                </h4>
                <ul className="space-y-2 text-sm text-amber-800 dark:text-amber-200">
                    <li className="flex items-start gap-2">
                        <span className="text-amber-500 font-bold dark:text-amber-400">1.</span>
                        <span>4 players in 2 teams (partners sit opposite). Bid for how many points your team will win.</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-amber-500 font-bold dark:text-amber-400">2.</span>
                        <span>The bid winner picks a hidden trump suit. Play 8 tricks, following suit rules.</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-amber-500 font-bold dark:text-amber-400">3.</span>
                        <span>Score card points from tricks won. First team to +6 or -6 game points wins!</span>
                    </li>
                </ul>
            </div>

            {/* Team preview */}
            {connectedPlayers.length === 4 && (
                <div className="mb-6 rounded-lg bg-gray-50 p-4 border border-gray-200 dark:bg-gray-900/40 dark:border-gray-700">
                    <h4 className="text-sm font-bold text-gray-600 mb-3 text-center dark:text-gray-400">Team Preview</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                            <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded-full dark:bg-blue-900/40 dark:text-blue-300">Team A</span>
                            <div className="mt-2 space-y-1">
                                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{connectedPlayers[0]?.nickname}</div>
                                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{connectedPlayers[2]?.nickname}</div>
                            </div>
                        </div>
                        <div className="text-center">
                            <span className="text-xs font-bold text-rose-600 bg-rose-100 px-2 py-1 rounded-full dark:bg-rose-900/40 dark:text-rose-300">Team B</span>
                            <div className="mt-2 space-y-1">
                                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{connectedPlayers[1]?.nickname}</div>
                                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{connectedPlayers[3]?.nickname}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Players list */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-gray-700 dark:text-gray-300">
                        Players ({connectedPlayers.length}/{maxPlayers})
                    </h4>
                    {!canStart && (
                        <span className="text-sm text-amber-600 font-medium dark:text-amber-400">
                            Need {minPlayers - connectedPlayers.length} more player{minPlayers - connectedPlayers.length !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                    {connectedPlayers.map((player) => (
                        <PlayerCard
                            key={player.id}
                            player={player}
                            currentPlayerId={currentPlayerId ?? 0}
                            showVoiceControls={!!currentPlayerId}
                        />
                    ))}
                </div>
            </div>

            {/* Start button for host */}
            {isHost && (
                <button
                    onClick={handleStart}
                    disabled={!canStart}
                    className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4 text-lg font-black text-white shadow-lg hover:from-amber-600 hover:to-amber-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 active:scale-95 disabled:hover:scale-100 border-b-4 border-amber-700 disabled:border-gray-600"
                >
                    {canStart ? <><GameIcon name="gamepad" className="inline-block mr-1" /> Start Game!</> : 'Need 4 players to start'}
                </button>
            )}

            <TwentyEightTutorial show={showTutorial} onClose={() => setShowTutorial(false)} />
        </div>
    );
}
