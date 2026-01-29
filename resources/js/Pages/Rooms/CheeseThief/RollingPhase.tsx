import { GameState } from '@/types';
import { router } from '@inertiajs/react';
import { useSound } from '@/hooks/useSound';
import DieDisplay from './components/DieDisplay';
import PlayerCircle from './components/PlayerCircle';

interface RollingPhaseProps {
    gameState: GameState;
    roomCode: string;
}

export default function RollingPhase({ gameState, roomCode }: RollingPhaseProps) {
    const currentPlayer = gameState.players.find((p) => p.id === gameState.current_player_id);
    const confirmedCount = gameState.players.filter((p) => p.has_confirmed_roll).length;
    const hasConfirmed = currentPlayer?.has_confirmed_roll ?? false;

    // Sound effects
    const { play: playDieRoll } = useSound('/sounds/cheese-thief/die-roll.mp3', { volume: 0.7 });

    const handleConfirm = () => {
        playDieRoll();
        router.post(route('rooms.confirmRoll', roomCode));
    };

    return (
        <div className="flex flex-col items-center gap-8">
            {/* Header */}
            <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900">
                    {'\u{1F3B2}'} Roll Your Die!
                </h2>
                <p className="mt-2 text-gray-600">
                    Your die determines when you wake up during the night
                </p>
            </div>

            {/* Your Die */}
            <div className="flex flex-col items-center gap-4 rounded-2xl bg-gradient-to-br from-teal-50 to-cyan-50 p-8 shadow-lg">
                <DieDisplay value={currentPlayer?.die_value ?? null} size="lg" />
                <p className="text-lg font-medium text-gray-700">
                    You wake up at{' '}
                    <span className="font-bold text-brand-teal">
                        {currentPlayer?.die_value ?? '?'} AM
                    </span>
                </p>
                {gameState.is_thief && (
                    <div className="mt-2 rounded-lg bg-red-100 px-4 py-2 text-sm text-red-700">
                        {'\u{1F977}'} You are the <strong>Sneaky Thief</strong>! Don&apos;t get caught!
                    </div>
                )}
            </div>

            {/* Confirm Button */}
            <button
                onClick={handleConfirm}
                disabled={hasConfirmed}
                className={`
                    rounded-xl px-8 py-4 text-lg font-semibold transition-all
                    ${hasConfirmed
                        ? 'bg-green-100 text-green-700 cursor-not-allowed'
                        : 'bg-brand-teal text-white hover:bg-teal-600 hover:scale-105'
                    }
                `}
            >
                {hasConfirmed ? '\u2713 Got it!' : 'Got it!'}
            </button>

            {/* Waiting Status */}
            <div className="text-center text-gray-600">
                <p>
                    Waiting: <strong>{confirmedCount}/{gameState.total_players}</strong> confirmed
                </p>
            </div>

            {/* Players */}
            <div className="w-full">
                <h3 className="mb-4 text-center text-lg font-semibold text-gray-700">Players</h3>
                <PlayerCircle
                    players={gameState.players}
                    currentPlayerId={gameState.current_player_id}
                    awakePlayerIds={[]}
                    currentHour={gameState.current_hour}
                />
            </div>
        </div>
    );
}
