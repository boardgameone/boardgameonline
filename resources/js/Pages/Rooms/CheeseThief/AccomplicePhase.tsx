import { GameState, GameStatePlayer } from '@/types';
import { router } from '@inertiajs/react';
import { useState } from 'react';
import { useSound } from '@/hooks/useSound';
import PlayerCircle from './components/PlayerCircle';

interface AccomplicePhaseProps {
    gameState: GameState;
    roomCode: string;
    gameSlug: string;
}

export default function AccomplicePhase({ gameState, roomCode, gameSlug }: AccomplicePhaseProps) {
    const [selectedPlayer, setSelectedPlayer] = useState<GameStatePlayer | null>(null);

    const canSelectAccomplice = gameState.can_select_accomplice;
    const isThief = gameState.is_thief;

    // Sound effects
    const { play: playWhisper } = useSound('/sounds/cheese-thief/whisper.mp3', { volume: 0.7 });

    // Players thief can select as accomplice (everyone except themselves)
    const selectablePlayerIds = gameState.players
        .filter((p) => p.id !== gameState.current_player_id)
        .map((p) => p.id);

    const handleSelectAccomplice = () => {
        if (selectedPlayer) {
            playWhisper();
            router.post(route('rooms.selectAccomplice', [gameSlug, roomCode]), {
                accomplice_player_id: selectedPlayer.id,
            });
        }
    };

    const handlePlayerClick = (player: GameStatePlayer) => {
        if (canSelectAccomplice && player.id !== gameState.current_player_id) {
            setSelectedPlayer(player);
        }
    };

    return (
        <div className="flex flex-col items-center gap-6">
            {/* Header */}
            <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900">
                    {'\u{1F91D}'} Accomplice Selection
                </h2>
                <p className="mt-2 text-gray-600">
                    The thief is choosing their accomplice...
                </p>
            </div>

            {/* Cheese Stolen Alert */}
            {gameState.cheese_stolen && (
                <div className="rounded-lg bg-yellow-100 px-6 py-3 text-yellow-800">
                    {'\u{1F9C0}'} <strong>The cheese has been stolen!</strong> Someone peeked at the thief!
                </div>
            )}

            {/* Thief View */}
            {isThief && (
                <div className="rounded-2xl bg-red-50 p-6 text-center border-2 border-red-200">
                    <p className="text-lg font-medium text-red-800">
                        {'\u{1F977}'} You are the thief!
                    </p>
                    <p className="mt-2 text-red-700">
                        Choose an accomplice. If you&apos;re not caught, you both win!
                    </p>
                </div>
            )}

            {/* Non-Thief View */}
            {!isThief && (
                <div className="rounded-2xl bg-gray-100 p-6 text-center">
                    <p className="text-lg text-gray-600">
                        {'\u{1F401}'} You are an innocent mouse.
                    </p>
                    <p className="mt-2 text-gray-500">
                        Waiting for the thief to choose their accomplice...
                    </p>
                </div>
            )}

            {/* Players */}
            <div className="w-full">
                <h3 className="mb-4 text-center text-lg font-semibold text-gray-700">
                    {canSelectAccomplice ? 'Select your accomplice:' : 'Players'}
                </h3>
                <PlayerCircle
                    players={gameState.players}
                    currentPlayerId={gameState.current_player_id}
                    awakePlayerIds={[]}
                    currentHour={gameState.current_hour}
                    onPlayerClick={handlePlayerClick}
                    clickablePlayerIds={canSelectAccomplice ? selectablePlayerIds : []}
                    showDice={true}
                />
            </div>

            {/* Selection Confirmation */}
            {canSelectAccomplice && selectedPlayer && (
                <div className="flex flex-col items-center gap-3">
                    <p className="text-gray-600">
                        Make <strong>{selectedPlayer.nickname}</strong> your accomplice?
                    </p>
                    <button
                        onClick={handleSelectAccomplice}
                        className="rounded-xl bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700"
                    >
                        {'\u{1F91D}'} Choose as Accomplice
                    </button>
                </div>
            )}
        </div>
    );
}
