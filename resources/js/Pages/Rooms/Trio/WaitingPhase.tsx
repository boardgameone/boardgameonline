import { router } from '@inertiajs/react';
import { useState } from 'react';
import TutorialModal from './components/TutorialModal';
import SoundToggle from '../CheeseThief/components/SoundToggle';
import { useSound } from '@/hooks/useSound';
import GameIcon from '@/Components/GameIcon';
import PlayerCard from '@/Components/PlayerCard';

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

    const { play: playGameStart } = useSound('/sounds/trio/game-start.mp3', { volume: 0.7 });

    const handleStart = () => {
        playGameStart();
        router.post(route('rooms.trio.start', [gameSlug, roomCode]));
    };

    return (
        <div className="rounded-xl bg-white p-8 shadow-lg dark:bg-gray-800">
            {/* Header with help button and sound toggle */}
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    Waiting Room
                </h3>
                <div className="flex items-center gap-2">
                    <SoundToggle />
                    <button
                        onClick={() => setShowTutorial(true)}
                        className="rounded-lg bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-200 transition dark:bg-blue-900/40 dark:text-blue-200 dark:hover:bg-blue-900/60"
                    >
                        <GameIcon name="book" className="inline-block mr-1" /> How to Play
                    </button>
                </div>
            </div>

            {/* Game rules summary */}
            <div className="mb-6 rounded-lg bg-linear-to-r from-blue-50 to-indigo-50 p-6 border border-blue-200 dark:from-blue-900/20 dark:to-indigo-900/20 dark:border-blue-800">
                <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2 dark:text-blue-200">
                    <GameIcon name="card" size="lg" className="text-blue-600 dark:text-blue-300" />
                    Game Rules
                </h4>
                <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                    <li className="flex items-start gap-2">
                        <span className="text-blue-500 font-bold dark:text-blue-400">1.</span>
                        <span>Reveal cards from the middle grid or ask players for their highest/lowest card</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-blue-500 font-bold dark:text-blue-400">2.</span>
                        <span>Collect 3 matching cards to claim a trio</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-blue-500 font-bold dark:text-blue-400">3.</span>
                        <span>First player to collect 3 trios wins!</span>
                    </li>
                </ul>
            </div>

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

                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
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
                    className="w-full rounded-xl bg-linear-to-r from-green-500 to-green-600 px-6 py-4 text-lg font-black text-white shadow-lg hover:from-green-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 active:scale-95 disabled:hover:scale-100 border-b-4 border-green-700 disabled:border-gray-600"
                >
                    {canStart ? <><GameIcon name="gamepad" className="inline-block mr-1" /> Start Game!</> : `Need ${minPlayers} players to start`}
                </button>
            )}

            {/* Tutorial Modal */}
            <TutorialModal show={showTutorial} onClose={() => setShowTutorial(false)} />
        </div>
    );
}
