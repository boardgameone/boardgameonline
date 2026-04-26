import { GameState } from '@/types';
import { router } from '@inertiajs/react';
import { useState } from 'react';
import { useSound } from '@/hooks/useSound';
import DieDisplay from './components/DieDisplay';
import GameTable from './components/GameTable';

interface RollingPhaseProps {
    gameState: GameState;
    roomCode: string;
    gameSlug: string;
}

export default function RollingPhase({ gameState, roomCode, gameSlug }: RollingPhaseProps) {
    const [isConfirming, setIsConfirming] = useState(false);

    const currentPlayer = gameState.players.find((p) => p.id === gameState.current_player_id);
    const confirmedCount = gameState.players.filter((p) => p.has_confirmed_roll).length;
    const hasConfirmed = currentPlayer?.has_confirmed_roll ?? false;

    const { play: playDieRoll } = useSound('/sounds/cheese-thief/die-roll.mp3', { volume: 0.7 });

    const handleConfirm = () => {
        if (isConfirming || hasConfirmed) {
            return;
        }
        playDieRoll();
        router.post(
            route('rooms.confirmRoll', [gameSlug, roomCode]),
            {},
            {
                onStart: () => setIsConfirming(true),
                onFinish: () => setIsConfirming(false),
            },
        );
    };

    return (
        <div className="flex flex-col items-center gap-6">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-slate-100">
                    🎲 Roll Your Die
                </h2>
                <p className="mt-2 text-slate-300">
                    Your die determines when you wake up during the night.
                </p>
            </div>

            {gameState.is_thief && (
                <div className="rounded-lg bg-red-100/90 px-4 py-2 text-sm text-red-700 ring-1 ring-red-300">
                    {'\u{1F977}'} You are the <strong>Sneaky Thief</strong>! Don&apos;t get caught.
                </div>
            )}

            {/* Game table — viewer's die fills the central slot */}
            <GameTable
                players={gameState.players}
                currentPlayerId={gameState.current_player_id}
                awakePlayerIds={[]}
                currentHour={gameState.current_hour}
            >
                <div className="flex flex-col items-center justify-center gap-3 rounded-3xl bg-slate-900/70 px-6 py-5 shadow-inner ring-1 ring-amber-200/15">
                    <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-200/80">
                        Your wake hour
                    </span>
                    <DieDisplay value={currentPlayer?.die_value ?? null} size="lg" />
                    <span className="text-sm font-medium text-amber-100">
                        {currentPlayer?.die_value != null ? `${currentPlayer.die_value} AM` : 'Rolling…'}
                    </span>
                </div>
            </GameTable>

            <button
                onClick={handleConfirm}
                disabled={hasConfirmed || isConfirming}
                className={`
                    rounded-xl px-8 py-4 text-lg font-semibold transition-all
                    ${hasConfirmed
                        ? 'bg-emerald-100 text-emerald-700 cursor-not-allowed'
                        : isConfirming
                            ? 'bg-teal-400 text-white cursor-wait opacity-80'
                            : 'bg-brand-teal text-white hover:bg-teal-600 hover:scale-105'
                    }
                `}
            >
                {hasConfirmed ? '✓ Got it!' : isConfirming ? 'Saving…' : 'Got it!'}
            </button>

            <p className="text-sm text-slate-300">
                Ready: <strong className="text-slate-100">{confirmedCount}/{gameState.total_players}</strong>
            </p>
        </div>
    );
}
