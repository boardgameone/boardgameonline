import { GameState } from '@/types';
import { useEffect } from 'react';
import { useSound } from '@/hooks/useSound';
import { router } from '@inertiajs/react';
import PlayerCircle from './components/PlayerCircle';

interface ResultsPhaseProps {
    gameState: GameState;
    roomCode: string;
    gameSlug: string;
}

export default function ResultsPhase({ gameState, roomCode, gameSlug }: ResultsPhaseProps) {
    const winner = gameState.winner;
    const thiefPlayer = gameState.players.find((p) => p.id === gameState.thief_player_id);
    const accomplicePlayer = gameState.players.find((p) => p.id === gameState.accomplice_player_id);
    const currentPlayer = gameState.players.find((p) => p.id === gameState.current_player_id);

    // Sound effects
    const { play: playVictory } = useSound('/sounds/cheese-thief/victory.mp3', { volume: 0.8 });
    const { play: playDefeat } = useSound('/sounds/cheese-thief/defeat.mp3', { volume: 0.8 });

    // Sort players by vote count
    const sortedPlayers = [...gameState.players].sort((a, b) => {
        const votesA = gameState.vote_counts[a.id] || 0;
        const votesB = gameState.vote_counts[b.id] || 0;
        return votesB - votesA;
    });

    // Determine if current player won
    const isThief = gameState.is_thief;
    const isAccomplice = gameState.is_accomplice;
    const playerWon = winner === 'thief' ? (isThief || isAccomplice) : (!isThief && !isAccomplice);

    // Play victory or defeat sound when results load
    useEffect(() => {
        if (playerWon) {
            playVictory();
        } else {
            playDefeat();
        }
    }, [playerWon]);

    return (
        <div className="flex flex-col items-center gap-6">
            {/* Winner Banner */}
            <div className={`
                w-full rounded-2xl p-8 text-center
                ${winner === 'mice'
                    ? 'bg-gradient-to-br from-blue-100 to-green-100'
                    : 'bg-gradient-to-br from-red-100 to-orange-100'
                }
            `}>
                <div className="text-5xl mb-4">
                    {winner === 'mice' ? '\u{1F389}' : '\u{1F977}'}
                </div>
                <h2 className="text-3xl font-bold text-gray-900">
                    {winner === 'mice' ? 'Innocent Mice WIN!' : 'The Thief Wins!'}
                </h2>
                <p className="mt-2 text-lg text-gray-700">
                    {winner === 'mice'
                        ? 'The thief was caught!'
                        : 'The thief escaped with the cheese!'
                    }
                </p>
            </div>

            {/* Your Result */}
            <div className={`
                rounded-xl px-6 py-4 text-center
                ${playerWon ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
            `}>
                <p className="font-semibold">
                    {playerWon ? '\u{1F389} You Won!' : '\u{1F61E} You Lost!'}
                </p>
                <p className="text-sm mt-1">
                    You were: {isThief ? 'The Thief \u{1F977}' : isAccomplice ? 'The Accomplice \u{1F91D}' : 'An Innocent Mouse \u{1F401}'}
                </p>
            </div>

            {/* Reveal Roles */}
            <div className="w-full rounded-xl bg-gray-50 p-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-4 text-center">
                    Roles Revealed
                </h3>
                <div className="flex justify-center gap-8">
                    <div className="text-center">
                        <div
                            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-white font-bold text-2xl"
                            style={{ backgroundColor: thiefPlayer?.avatar_color }}
                        >
                            {thiefPlayer?.nickname.charAt(0).toUpperCase()}
                        </div>
                        <p className="mt-2 font-medium">{thiefPlayer?.nickname}</p>
                        <p className="text-sm text-red-600">{'\u{1F977}'} Thief</p>
                    </div>
                    {accomplicePlayer && (
                        <div className="text-center">
                            <div
                                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-white font-bold text-2xl"
                                style={{ backgroundColor: accomplicePlayer?.avatar_color }}
                            >
                                {accomplicePlayer?.nickname.charAt(0).toUpperCase()}
                            </div>
                            <p className="mt-2 font-medium">{accomplicePlayer?.nickname}</p>
                            <p className="text-sm text-orange-600">{'\u{1F91D}'} Accomplice</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Vote Results */}
            <div className="w-full rounded-xl bg-white p-6 shadow">
                <h3 className="text-lg font-semibold text-gray-700 mb-4 text-center">
                    Vote Results
                </h3>
                <div className="space-y-3">
                    {sortedPlayers.map((player) => {
                        const votes = gameState.vote_counts[player.id] || 0;
                        const maxVotes = Math.max(...Object.values(gameState.vote_counts), 1);
                        const percentage = (votes / maxVotes) * 100;
                        const isThiefPlayer = player.id === gameState.thief_player_id;
                        const wasCaught = isThiefPlayer && votes === maxVotes && winner === 'mice';

                        return (
                            <div key={player.id} className="flex items-center gap-3">
                                <div
                                    className="flex h-10 w-10 items-center justify-center rounded-full text-white font-bold"
                                    style={{ backgroundColor: player.avatar_color }}
                                >
                                    {player.nickname.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-medium">
                                            {player.nickname}
                                            {isThiefPlayer && ' \u{1F977}'}
                                            {player.is_accomplice && ' \u{1F91D}'}
                                        </span>
                                        <span className="text-sm text-gray-500">
                                            {votes} vote{votes !== 1 ? 's' : ''}
                                            {wasCaught && ' \u2190 CAUGHT!'}
                                        </span>
                                    </div>
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                                        <div
                                            className={`h-full transition-all duration-500 ${
                                                wasCaught ? 'bg-green-500' : isThiefPlayer ? 'bg-red-400' : 'bg-indigo-400'
                                            }`}
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* All Players with Dice */}
            <div className="w-full">
                <h3 className="mb-4 text-center text-lg font-semibold text-gray-700">
                    All Players & Dice
                </h3>
                <PlayerCircle
                    players={gameState.players}
                    currentPlayerId={gameState.current_player_id}
                    awakePlayerIds={[]}
                    currentHour={gameState.current_hour}
                    showDice={true}
                />
            </div>

            {/* Play Again - Only host can reset */}
            {gameState.isHost && (
                <div className="mt-4">
                    <button
                        onClick={() => router.post(route('rooms.resetGame', [gameSlug, roomCode]))}
                        className="rounded-xl bg-indigo-600 px-8 py-4 font-semibold text-white hover:bg-indigo-700"
                    >
                        Play Again
                    </button>
                </div>
            )}
        </div>
    );
}
