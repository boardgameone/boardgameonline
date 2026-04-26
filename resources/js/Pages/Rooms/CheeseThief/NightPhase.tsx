import { GameState, GameStatePlayer } from '@/types';
import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { useSound, useRandomSound } from '@/hooks/useSound';
import GameTable from './components/GameTable';
import Stage from './components/Stage';
import Cheese from './components/Cheese';
import Curtains from './components/Curtains';
import HourNarrator from './components/HourNarrator';
import MouseNotes from './components/MouseNotes';

interface NightPhaseProps {
    gameState: GameState;
    roomCode: string;
    gameSlug: string;
}

export default function NightPhase({ gameState, roomCode, gameSlug }: NightPhaseProps) {
    const [selectedPeekTarget, setSelectedPeekTarget] = useState<GameStatePlayer | null>(null);
    const [isPeeking, setIsPeeking] = useState(false);
    const [isStealing, setIsStealing] = useState(false);

    const currentPlayer = gameState.players.find((p) => p.id === gameState.current_player_id);
    const isAwake = !!currentPlayer?.die_value && currentPlayer.die_value === gameState.current_hour;
    const otherAwake = gameState.players.filter(
        (p) => gameState.awake_player_ids.includes(p.id) && p.id !== gameState.current_player_id,
    );
    const cheesePresent = gameState.cheese_visible_to_self === 'present';
    const cheeseGone = gameState.cheese_visible_to_self === 'gone';
    const peekablePlayerIds = gameState.can_peek
        ? gameState.players.filter((p) => p.id !== gameState.current_player_id).map((p) => p.id)
        : [];

    const { play: playPeek } = useSound('/sounds/cheese-thief/peek.mp3', { volume: 0.7 });
    const { play: playCheeseMunch } = useSound('/sounds/cheese-thief/cheese-munch.mp3', { volume: 0.8 });
    const { play: playSneaking, stop: stopSneaking } = useSound('/sounds/cheese-thief/sneaking.mp3', {
        volume: 0.3,
        loop: true,
    });
    const { playRandom: playSqueak } = useRandomSound(
        [
            '/sounds/cheese-thief/mouse-squeak-1.mp3',
            '/sounds/cheese-thief/mouse-squeak-2.mp3',
            '/sounds/cheese-thief/mouse-squeak-3.mp3',
        ],
        { volume: 0.6 },
    );

    useEffect(() => {
        if (isAwake) {
            playSneaking();
        } else {
            stopSneaking();
        }
        return () => stopSneaking();
    }, [isAwake]);

    useEffect(() => {
        if (gameState.cheese_stolen) {
            playCheeseMunch();
            playSqueak();
        }
    }, [gameState.cheese_stolen]);

    const handleSteal = () => {
        if (isStealing) {
            return;
        }
        playCheeseMunch();
        router.post(
            route('rooms.stealCheese', [gameSlug, roomCode]),
            {},
            {
                onStart: () => setIsStealing(true),
                onFinish: () => setIsStealing(false),
            },
        );
    };

    const handlePlayerClick = (player: GameStatePlayer) => {
        if (gameState.can_peek && player.id !== gameState.current_player_id) {
            setSelectedPeekTarget(player);
        }
    };

    const handlePeek = () => {
        if (!selectedPeekTarget || isPeeking) {
            return;
        }
        playPeek();
        router.post(
            route('rooms.peek', [gameSlug, roomCode]),
            { target_player_id: selectedPeekTarget.id },
            {
                onStart: () => setIsPeeking(true),
                onFinish: () => setIsPeeking(false),
                onSuccess: () => setSelectedPeekTarget(null),
            },
        );
    };

    return (
        <div className="flex flex-col items-center gap-5 pb-28">
            <HourNarrator
                hour={gameState.current_hour}
                timerDuration={gameState.hour_timer_duration}
                startedAt={gameState.hour_started_at}
            />

            {/* Status banner — above the table */}
            <div
                className={`
                    w-full max-w-md rounded-2xl px-5 py-4 text-center shadow-md
                    ${isAwake
                        ? 'bg-gradient-to-b from-amber-50 to-amber-100 ring-2 ring-amber-300'
                        : 'bg-slate-800/60 ring-1 ring-slate-700 text-slate-200'}
                `}
            >
                {isAwake ? (
                    <>
                        <p className="text-lg font-bold text-amber-900">
                            {'\u{1F42D}'} You woke up at hour {gameState.current_hour}!
                        </p>

                        {gameState.can_steal_cheese && (
                            <button
                                onClick={handleSteal}
                                disabled={isStealing}
                                className="mt-3 rounded-xl bg-gradient-to-b from-rose-500 to-rose-700 px-6 py-3 text-lg font-bold text-white shadow-lg transition hover:scale-105 hover:from-rose-600 hover:to-rose-800 animate-pulse disabled:cursor-not-allowed disabled:opacity-60 disabled:animate-none"
                            >
                                {isStealing ? 'Sneaking…' : `${'\u{1F9C0}'} Steal the Cheese!`}
                            </button>
                        )}

                        {!gameState.can_steal_cheese && cheesePresent && (
                            <p className="mt-1 text-sm text-amber-800">
                                The cheese is right there, untouched.
                            </p>
                        )}

                        {cheeseGone && (
                            <p className="mt-1 text-sm font-medium text-rose-700">
                                The cheese is gone! Someone got here before you.
                            </p>
                        )}

                        {otherAwake.length > 0 && (
                            <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-amber-200/60 px-3 py-1 text-xs font-semibold text-amber-900">
                                {'\u{1F441}'} Also awake: {otherAwake.map((p) => p.nickname).join(', ')}
                            </p>
                        )}

                        {gameState.can_peek && (
                            <p className="mt-3 text-sm font-semibold text-indigo-900">
                                {'\u{1F50D}'} You're alone — peek at one mouse to learn their wake hour.
                            </p>
                        )}
                    </>
                ) : (
                    <p>
                        {currentPlayer?.die_value && currentPlayer.die_value < gameState.current_hour
                            ? `${'\u{1F4A4}'} Zzz... your hour (${currentPlayer.die_value}) has passed.`
                            : `${'\u{1F4A4}'} Zzz... waiting for hour ${currentPlayer?.die_value ?? '?'}.`}
                    </p>
                )}
            </div>

            <MouseNotes gameState={gameState} />

            {/* Game table — mice arranged around the central stage */}
            <GameTable
                players={gameState.players}
                currentPlayerId={gameState.current_player_id}
                awakePlayerIds={gameState.awake_player_ids}
                currentHour={gameState.current_hour}
                onPlayerClick={handlePlayerClick}
                clickablePlayerIds={peekablePlayerIds}
                selectedPlayerId={selectedPeekTarget?.id ?? null}
                showDice={true}
            >
                {/* Central stage (curtain + cheese) */}
                <div className="aspect-square w-full">
                    <Stage>
                        <Cheese present={cheesePresent} />
                        <Curtains open={isAwake} />
                    </Stage>
                </div>
            </GameTable>

            {/* Fixed-bottom peek confirm footer — slides up when a target is selected.
                Decoupled from the status banner so its appearance is stable across re-renders. */}
            <div
                className={`
                    pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4
                    transition-[transform,opacity] duration-300 ease-out
                    ${selectedPeekTarget ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}
                `}
            >
                <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-indigo-600/95 px-4 py-3 shadow-2xl ring-1 ring-indigo-300/60 backdrop-blur">
                    <span className="text-sm font-semibold text-white">
                        Peek at <strong>{selectedPeekTarget?.nickname ?? '...'}</strong>?
                    </span>
                    <button
                        onClick={handlePeek}
                        disabled={isPeeking || !selectedPeekTarget}
                        className="rounded-lg bg-white px-3 py-1.5 text-sm font-bold text-indigo-700 shadow hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isPeeking ? 'Peeking…' : '🔍 Peek'}
                    </button>
                    <button
                        onClick={() => setSelectedPeekTarget(null)}
                        disabled={isPeeking}
                        className="text-xs text-indigo-100 underline disabled:opacity-60"
                    >
                        cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
