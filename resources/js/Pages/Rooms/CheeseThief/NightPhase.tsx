import { GameState, GameStatePlayer } from '@/types';
import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { useSound, useRandomSound } from '@/hooks/useSound';
import PlayerCircle from './components/PlayerCircle';
import Stage from './components/Stage';
import Cheese from './components/Cheese';
import Curtains from './components/Curtains';
import HourNarrator from './components/HourNarrator';

interface NightPhaseProps {
    gameState: GameState;
    roomCode: string;
    gameSlug: string;
}

export default function NightPhase({ gameState, roomCode, gameSlug }: NightPhaseProps) {
    const [selectedPeekTarget, setSelectedPeekTarget] = useState<GameStatePlayer | null>(null);

    const currentPlayer = gameState.players.find((p) => p.id === gameState.current_player_id);
    const isAwake = gameState.awake_player_ids.includes(gameState.current_player_id ?? -1);
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

    // Poll the server every 1.5s during the night so settleNight() advances the
    // clock for everyone — including empty hours where nobody acts.
    useEffect(() => {
        const id = window.setInterval(() => {
            router.reload({ only: ['gameState'] });
        }, 1500);
        return () => window.clearInterval(id);
    }, []);

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
            {
                onSuccess: () => setSelectedPeekTarget(null),
            },
        );
    };

    const progress = (gameState.current_hour / 6) * 100;

    return (
        <div className="flex flex-col items-center gap-6">
            <HourNarrator
                hour={gameState.current_hour}
                timerDuration={gameState.hour_timer_duration}
                startedAt={gameState.hour_started_at}
            />

            <div className="h-2 w-48 overflow-hidden rounded-full bg-gray-200">
                <div
                    className="h-full bg-indigo-600 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                />
            </div>

            <div className="w-full max-w-xl">
                <Stage>
                    <Cheese present={cheesePresent} />
                    <Curtains open={isAwake} />
                </Stage>
            </div>

            <div
                className={`
                    rounded-2xl p-5 text-center w-full max-w-md
                    ${isAwake ? 'bg-amber-50 border-2 border-amber-300' : 'bg-slate-100'}
                `}
            >
                {isAwake ? (
                    <>
                        <p className="text-lg font-semibold text-amber-900">
                            🐭 You woke up at hour {gameState.current_hour}!
                        </p>

                        {gameState.can_steal_cheese && (
                            <button
                                onClick={handleSteal}
                                className="mt-4 rounded-xl bg-rose-600 px-6 py-3 text-lg font-bold text-white shadow-lg transition hover:scale-105 hover:bg-rose-700 animate-pulse"
                            >
                                🧀 Steal the Cheese!
                            </button>
                        )}

                        {!gameState.can_steal_cheese && cheesePresent && (
                            <p className="mt-2 text-amber-800">
                                The cheese is right there...
                            </p>
                        )}

                        {cheeseGone && (
                            <p className="mt-2 font-medium text-rose-700">
                                The cheese is gone! Someone got here before you.
                            </p>
                        )}

                        {otherAwake.length > 0 && (
                            <p className="mt-3 text-sm text-amber-700">
                                👀 Also awake: <strong>{otherAwake.map((p) => p.nickname).join(', ')}</strong>
                            </p>
                        )}

                        {gameState.can_peek && (
                            <div className="mt-4 rounded-lg bg-indigo-50 p-3 text-indigo-900">
                                <p className="text-sm font-semibold">
                                    👀 You're alone — peek at one mouse to learn their wake hour.
                                </p>
                                {selectedPeekTarget ? (
                                    <button
                                        onClick={handlePeek}
                                        className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                                    >
                                        Peek at {selectedPeekTarget.nickname}
                                    </button>
                                ) : (
                                    <p className="mt-1 text-xs italic text-indigo-700">
                                        Tap a mouse below to select.
                                    </p>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <p className="text-slate-600">
                        {currentPlayer?.die_value && currentPlayer.die_value < gameState.current_hour
                            ? `💤 Zzz... your hour (${currentPlayer.die_value}) has passed.`
                            : `💤 Zzz... waiting for hour ${currentPlayer?.die_value ?? '?'}`}
                    </p>
                )}
            </div>

            <div className="w-full">
                <h3 className="mb-3 text-center text-sm font-semibold uppercase tracking-wide text-slate-600">
                    Mice
                </h3>
                <PlayerCircle
                    players={gameState.players}
                    currentPlayerId={gameState.current_player_id}
                    awakePlayerIds={gameState.awake_player_ids}
                    currentHour={gameState.current_hour}
                    onPlayerClick={handlePlayerClick}
                    clickablePlayerIds={peekablePlayerIds}
                    showDice={true}
                />
            </div>
        </div>
    );
}
