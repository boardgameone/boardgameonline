import { GameState, GameStatePlayer } from '@/types';
import { router } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { useSound, useRandomSound } from '@/hooks/useSound';
import PlayerCircle from './components/PlayerCircle';

interface NightPhaseProps {
    gameState: GameState;
    roomCode: string;
}

export default function NightPhase({ gameState, roomCode }: NightPhaseProps) {
    const [selectedPlayer, setSelectedPlayer] = useState<GameStatePlayer | null>(null);

    const currentPlayer = gameState.players.find((p) => p.id === gameState.current_player_id);
    const isAwake = gameState.awake_player_ids.includes(gameState.current_player_id ?? -1);
    const isAlone = gameState.awake_player_ids.length === 1 && isAwake;
    const canPeek = gameState.can_peek;
    const canSkipPeek = gameState.can_skip_peek;

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
            router.post(route('rooms.peek', roomCode), {
                target_player_id: selectedPlayer.id,
            });
        }
    };

    const handleSkip = () => {
        router.post(route('rooms.skipPeek', roomCode));
    };

    const handlePlayerClick = (player: GameStatePlayer) => {
        if (canPeek && player.id !== gameState.current_player_id) {
            setSelectedPlayer(player);
        }
    };

    // Progress bar for night hours
    const progress = ((gameState.current_hour) / 6) * 100;

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
                            <p className="mt-2 text-yellow-700">
                                You&apos;re <strong>alone</strong>! You can peek at someone&apos;s die.
                            </p>
                        ) : (
                            <p className="mt-2 text-yellow-700">
                                Others are awake too. You can&apos;t peek this hour.
                            </p>
                        )}
                    </>
                ) : (
                    <p className="text-lg text-gray-600">
                        {'\u{1F4A4}'} You&apos;re sleeping... (Your die: {currentPlayer?.die_value})
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
