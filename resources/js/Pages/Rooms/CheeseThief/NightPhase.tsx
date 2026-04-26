import { GameState, GameStatePlayer } from '@/types';
import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { useSound, useRandomSound } from '@/hooks/useSound';
import PlayerCircle from './components/PlayerCircle';
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
        playCheeseMunch();
        router.post(route('rooms.stealCheese', [gameSlug, roomCode]));
    };

    const handlePlayerClick = (player: GameStatePlayer) => {
        if (gameState.can_peek && player.id !== gameState.current_player_id) {
            setSelectedPeekTarget(player);
        }
    };

    const handlePeek = () => {
        if (!selectedPeekTarget) return;
        playPeek();
        router.post(
            route('rooms.peek', [gameSlug, roomCode]),
            { target_player_id: selectedPeekTarget.id },
            { onSuccess: () => setSelectedPeekTarget(null) },
        );
    };

    return (
        <div className="flex flex-col items-center gap-5">
            <HourNarrator
                hour={gameState.current_hour}
                timerDuration={gameState.hour_timer_duration}
                startedAt={gameState.hour_started_at}
            />

            {/* Stage */}
            <div className="w-full max-w-xl">
                <Stage>
                    <Cheese present={cheesePresent} />
                    <Curtains open={isAwake} />
                </Stage>
            </div>

            {/* Status banner — anchors directly under the stage */}
            <div
                className={`
                    -mt-2 w-full max-w-md rounded-2xl px-5 py-4 text-center shadow-md
                    ${isAwake
                        ? 'bg-gradient-to-b from-amber-50 to-amber-100 ring-2 ring-amber-300'
                        : 'bg-slate-50 ring-1 ring-slate-200'}
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
                                className="mt-3 rounded-xl bg-gradient-to-b from-rose-500 to-rose-700 px-6 py-3 text-lg font-bold text-white shadow-lg transition hover:scale-105 hover:from-rose-600 hover:to-rose-800 animate-pulse"
                            >
                                {'\u{1F9C0}'} Steal the Cheese!
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
                            <div className="mt-4 rounded-xl bg-indigo-50 p-3 ring-1 ring-indigo-200">
                                <p className="text-sm font-semibold text-indigo-900">
                                    {'\u{1F50D}'} You're alone — peek at one mouse to learn their wake hour.
                                </p>
                                {selectedPeekTarget ? (
                                    <div className="mt-2 flex items-center justify-center gap-2">
                                        <button
                                            onClick={handlePeek}
                                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700"
                                        >
                                            Peek at {selectedPeekTarget.nickname}
                                        </button>
                                        <button
                                            onClick={() => setSelectedPeekTarget(null)}
                                            className="text-xs text-indigo-600 underline"
                                        >
                                            cancel
                                        </button>
                                    </div>
                                ) : (
                                    <p className="mt-1 text-xs italic text-indigo-700">
                                        {'\u{1F447}'} Tap a glowing mouse below to select.
                                    </p>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <p className="text-slate-600">
                        {currentPlayer?.die_value && currentPlayer.die_value < gameState.current_hour
                            ? `${'\u{1F4A4}'} Zzz... your hour (${currentPlayer.die_value}) has passed.`
                            : `${'\u{1F4A4}'} Zzz... waiting for hour ${currentPlayer?.die_value ?? '?'}.`}
                    </p>
                )}
            </div>

            {/* Persistent player notes — your die + everything you've peeked */}
            <MouseNotes gameState={gameState} />

            {/* Player cards row */}
            <div className="w-full">
                <h3 className="mb-3 text-center text-xs font-bold uppercase tracking-[0.25em] text-slate-500">
                    {'\u{1F42D}'} The Mice
                </h3>
                <PlayerCircle
                    players={gameState.players}
                    currentPlayerId={gameState.current_player_id}
                    awakePlayerIds={gameState.awake_player_ids}
                    currentHour={gameState.current_hour}
                    onPlayerClick={handlePlayerClick}
                    clickablePlayerIds={peekablePlayerIds}
                    selectedPlayerId={selectedPeekTarget?.id ?? null}
                    showDice={true}
                />
            </div>
        </div>
    );
}
