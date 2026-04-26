import { GameState, GameStatePlayer } from '@/types';
import { router } from '@inertiajs/react';
import { useState } from 'react';
import { useSound } from '@/hooks/useSound';
import GameTable from './components/GameTable';
import MouseNotes from './components/MouseNotes';

interface AccomplicePhaseProps {
    gameState: GameState;
    roomCode: string;
    gameSlug: string;
}

export default function AccomplicePhase({ gameState, roomCode, gameSlug }: AccomplicePhaseProps) {
    const [selectedPlayer, setSelectedPlayer] = useState<GameStatePlayer | null>(null);
    const [isConfirming, setIsConfirming] = useState(false);

    const canSelectAccomplice = gameState.can_select_accomplice;
    const isThief = gameState.is_thief;

    const { play: playWhisper } = useSound('/sounds/cheese-thief/whisper.mp3', { volume: 0.7 });

    const selectablePlayerIds = canSelectAccomplice
        ? gameState.players
            .filter((p) => p.id !== gameState.current_player_id)
            .map((p) => p.id)
        : [];

    const handleSelectAccomplice = () => {
        if (!selectedPlayer || isConfirming) {
            return;
        }
        playWhisper();
        router.post(
            route('rooms.selectAccomplice', [gameSlug, roomCode]),
            { accomplice_player_id: selectedPlayer.id },
            {
                onStart: () => setIsConfirming(true),
                onFinish: () => setIsConfirming(false),
            },
        );
    };

    const handlePlayerClick = (player: GameStatePlayer) => {
        if (canSelectAccomplice && player.id !== gameState.current_player_id) {
            setSelectedPlayer(player);
        }
    };

    return (
        <div className="flex flex-col items-center gap-5 pb-28">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-slate-100">
                    {'\u{1F91D}'} Accomplice Selection
                </h2>
                <p className="mt-2 text-slate-300">
                    The thief is choosing their accomplice…
                </p>
            </div>

            {gameState.cheese_stolen && (
                <div className="rounded-lg bg-yellow-100 px-6 py-3 text-yellow-800">
                    🧀 <strong>The cheese is gone!</strong> The thief struck during the night.
                </div>
            )}

            {isThief ? (
                <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-5 text-center">
                    <p className="text-lg font-semibold text-red-800">
                        {'\u{1F977}'} You are the thief!
                    </p>
                    <p className="mt-1 text-sm text-red-700">
                        Choose an accomplice. If you&apos;re not caught, you both win.
                    </p>
                </div>
            ) : (
                <div className="rounded-2xl bg-slate-800/60 p-5 text-center text-slate-200 ring-1 ring-slate-700">
                    <p className="text-lg">{'\u{1F401}'} You are an innocent mouse.</p>
                    <p className="mt-1 text-sm text-slate-400">Waiting for the thief to choose…</p>
                </div>
            )}

            <MouseNotes gameState={gameState} />

            <GameTable
                players={gameState.players}
                currentPlayerId={gameState.current_player_id}
                awakePlayerIds={[]}
                currentHour={gameState.current_hour}
                onPlayerClick={handlePlayerClick}
                clickablePlayerIds={selectablePlayerIds}
                selectedPlayerId={selectedPlayer?.id ?? null}
                showDice={true}
            >
                <div className="flex flex-col items-center justify-center gap-2 rounded-3xl bg-slate-900/70 px-5 py-4 text-center shadow-inner ring-1 ring-red-300/20">
                    <span className="text-3xl">{'\u{1F91D}'}</span>
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-200/85">
                        {canSelectAccomplice ? 'Pick an Accomplice' : 'Whispers in the Dark'}
                    </span>
                </div>
            </GameTable>

            {/* Fixed-bottom confirm footer */}
            <div
                className={`
                    pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4
                    transition-[transform,opacity] duration-300 ease-out
                    ${canSelectAccomplice && selectedPlayer ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}
                `}
            >
                <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-red-600/95 px-4 py-3 shadow-2xl ring-1 ring-red-300/60 backdrop-blur">
                    <span className="text-sm font-semibold text-white">
                        Make <strong>{selectedPlayer?.nickname ?? '...'}</strong> your accomplice?
                    </span>
                    <button
                        onClick={handleSelectAccomplice}
                        disabled={isConfirming || !selectedPlayer}
                        className="rounded-lg bg-white px-3 py-1.5 text-sm font-bold text-red-700 shadow hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isConfirming ? 'Saving…' : `${'\u{1F91D}'} Confirm`}
                    </button>
                    <button
                        onClick={() => setSelectedPlayer(null)}
                        disabled={isConfirming}
                        className="text-xs text-red-100 underline disabled:opacity-60"
                    >
                        cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
