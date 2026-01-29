import { GameState, GameStatePlayer } from '@/types';
import { router } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { useSound, useRandomSound } from '@/hooks/useSound';
import { useNightPhaseTimer } from '@/hooks/useNightPhaseTimer';
import PlayerCircle from './components/PlayerCircle';

interface NightPhaseProps {
    gameState: GameState;
    roomCode: string;
    gameSlug: string;
}

export default function NightPhase({ gameState, roomCode, gameSlug }: NightPhaseProps) {
    const [selectedPlayer, setSelectedPlayer] = useState<GameStatePlayer | null>(null);

    const currentPlayer = gameState.players.find((p) => p.id === gameState.current_player_id);
    const isAwake = gameState.awake_player_ids.includes(gameState.current_player_id ?? -1);
    const isAlone = gameState.awake_player_ids.length === 1 && isAwake;
    const canPeek = gameState.can_peek;
    const canSkipPeek = gameState.can_skip_peek;

    // Timer hook
    const { timeRemaining, isExpired, percentage } = useNightPhaseTimer(
        gameState.hour_started_at,
        gameState.hour_timer_duration
    );

    // Determine if player has acted early (completed action but timer still running)
    const hasActedEarly = isAwake && isAlone && !canPeek && !isExpired;

    // Sound effects
    const { play: playPeek } = useSound('/sounds/cheese-thief/peek.mp3', { volume: 0.7 });
    const { play: playCheeseMunch } = useSound('/sounds/cheese-thief/cheese-munch.mp3', { volume: 0.8 });
    const { play: playSneaking, stop: stopSneaking } = useSound('/sounds/cheese-thief/sneaking.mp3', {
        volume: 0.3,
        loop: true
    });
    const { playRandom: playSqueak } = useRandomSound([
        '/sounds/cheese-thief/mouse-squeak-1.mp3',
        '/sounds/cheese-thief/mouse-squeak-2.mp3',
        '/sounds/cheese-thief/mouse-squeak-3.mp3',
    ], { volume: 0.6 });

    // Play sneaking sound when awake and alone
    useEffect(() => {
        if (isAwake && isAlone) {
            playSneaking();
        } else {
            stopSneaking();
        }

        return () => stopSneaking();
    }, [isAwake, isAlone]);

    // Play cheese munch sound when cheese is stolen
    useEffect(() => {
        if (gameState.cheese_stolen) {
            playCheeseMunch();
            playSqueak();
        }
    }, [gameState.cheese_stolen]);

    // Players you can peek at (everyone except yourself)
    const peekablePlayerIds = gameState.players
        .filter((p) => p.id !== gameState.current_player_id)
        .map((p) => p.id);

    const handlePeek = () => {
        if (selectedPlayer) {
            playPeek();
            playSqueak();
            router.post(route('rooms.peek', [gameSlug, roomCode]), {
                target_player_id: selectedPlayer.id,
            });
        }
    };

    const handleSkip = () => {
        router.post(route('rooms.skipPeek', [gameSlug, roomCode]));
    };

    const handlePlayerClick = (player: GameStatePlayer) => {
        if (canPeek && player.id !== gameState.current_player_id) {
            setSelectedPlayer(player);
        }
    };

    // Progress bar for night hours
    const progress = ((gameState.current_hour) / 6) * 100;

    // Timer color based on time remaining
    const getTimerColor = () => {
        if (timeRemaining > 10) return 'text-green-600';
        if (timeRemaining > 5) return 'text-yellow-600';
        return 'text-red-600';
    };

    const getTimerBgColor = () => {
        if (timeRemaining > 10) return 'stroke-green-600';
        if (timeRemaining > 5) return 'stroke-yellow-600';
        return 'stroke-red-600';
    };

    return (
        <div className="flex flex-col items-center gap-6">
            {/* Header */}
            <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900">
                    {'\u{1F319}'} Night - {gameState.current_hour} AM
                </h2>
                <div className="mt-2 h-2 w-48 overflow-hidden rounded-full bg-gray-200">
                    <div
                        className="h-full bg-indigo-600 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Timer Display */}
            {gameState.hour_started_at && (
                <div className="flex flex-col items-center gap-2">
                    <div className="relative h-24 w-24">
                        {/* Background circle */}
                        <svg className="h-24 w-24 -rotate-90 transform">
                            <circle
                                cx="48"
                                cy="48"
                                r="40"
                                stroke="currentColor"
                                strokeWidth="6"
                                fill="transparent"
                                className="text-gray-200"
                            />
                            {/* Progress circle */}
                            <circle
                                cx="48"
                                cy="48"
                                r="40"
                                stroke="currentColor"
                                strokeWidth="6"
                                fill="transparent"
                                strokeDasharray={251.2}
                                strokeDashoffset={251.2 * (1 - percentage / 100)}
                                className={`${getTimerBgColor()} transition-all duration-100`}
                                strokeLinecap="round"
                            />
                        </svg>
                        {/* Timer text */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className={`text-2xl font-bold ${getTimerColor()}`}>
                                {Math.ceil(timeRemaining)}
                            </span>
                        </div>
                    </div>
                    <p className="text-sm text-gray-600">
                        {isExpired ? 'Time up!' : 'seconds remaining'}
                    </p>
                </div>
            )}

            {/* Cheese Stolen Alert */}
            {gameState.cheese_stolen && (
                <div className="rounded-lg bg-yellow-100 px-6 py-3 text-yellow-800">
                    {'\u{1F9C0}'} <strong>The cheese has been stolen!</strong> Someone peeked at the thief!
                </div>
            )}

            {/* Your Status */}
            <div className={`
                rounded-2xl p-6 text-center
                ${isAwake ? 'bg-yellow-50 border-2 border-yellow-300' : 'bg-gray-100'}
            `}>
                {isAwake ? (
                    <>
                        <p className="text-lg font-medium text-yellow-800">
                            {'\u{1F441}'} You woke up at {gameState.current_hour} AM!
                        </p>
                        {isAlone ? (
                            hasActedEarly ? (
                                <p className="mt-2 text-yellow-700">
                                    Waiting for hour to complete...
                                </p>
                            ) : canPeek ? (
                                <p className="mt-2 text-yellow-700">
                                    You&apos;re <strong>alone</strong>! Peek or skip before time runs out!
                                </p>
                            ) : (
                                <p className="mt-2 text-yellow-700">
                                    Waiting for hour to complete...
                                </p>
                            )
                        ) : (
                            <p className="mt-2 text-yellow-700">
                                Others are awake too. You can&apos;t peek this hour.
                            </p>
                        )}
                    </>
                ) : (
                    <p className="text-lg text-gray-600">
                        {'\u{1F4A4}'} Zzz... waiting for your hour... (Your die: {currentPlayer?.die_value})
                    </p>
                )}
            </div>

            {/* Players */}
            <div className="w-full">
                <h3 className="mb-4 text-center text-lg font-semibold text-gray-700">
                    {isAwake && isAlone ? 'Select a player to peek at:' : 'Players'}
                </h3>
                <PlayerCircle
                    players={gameState.players}
                    currentPlayerId={gameState.current_player_id}
                    awakePlayerIds={gameState.awake_player_ids}
                    currentHour={gameState.current_hour}
                    onPlayerClick={handlePlayerClick}
                    clickablePlayerIds={canPeek ? peekablePlayerIds : []}
                    showDice={true}
                />
            </div>

            {/* Action Buttons */}
            {canPeek && (
                <div className="flex flex-col items-center gap-4">
                    {selectedPlayer && (
                        <div className="text-center">
                            <p className="text-gray-600">
                                Peek at <strong>{selectedPlayer.nickname}</strong>?
                            </p>
                            <button
                                onClick={handlePeek}
                                className="mt-2 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700"
                            >
                                {'\u{1F440}'} Peek at their die
                            </button>
                        </div>
                    )}
                    {canSkipPeek && (
                        <button
                            onClick={handleSkip}
                            className="text-gray-500 underline hover:text-gray-700"
                        >
                            Skip - don&apos;t peek
                        </button>
                    )}
                </div>
            )}

            {/* Waiting message when not your turn */}
            {!canPeek && isAwake && !isAlone && (
                <p className="text-gray-500">
                    Waiting for the night to pass...
                </p>
            )}
            {!isAwake && (
                <p className="text-gray-500">
                    {'\u{1F4A4}'} Zzz... waiting for your hour...
                </p>
            )}
        </div>
    );
}
