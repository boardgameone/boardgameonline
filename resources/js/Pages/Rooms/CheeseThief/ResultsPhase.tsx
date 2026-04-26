import { GameState } from '@/types';
import { useEffect, useState } from 'react';
import { useSound } from '@/hooks/useSound';
import { router } from '@inertiajs/react';
import GameTable from './components/GameTable';

interface ResultsPhaseProps {
    gameState: GameState;
    roomCode: string;
    gameSlug: string;
}

export default function ResultsPhase({ gameState, roomCode, gameSlug }: ResultsPhaseProps) {
    const [isResetting, setIsResetting] = useState(false);

    const winner = gameState.winner;
    const thiefPlayer = gameState.players.find((p) => p.id === gameState.thief_player_id);
    const accomplicePlayer = gameState.players.find((p) => p.id === gameState.accomplice_player_id);

    const { play: playVictory } = useSound('/sounds/cheese-thief/victory.mp3', { volume: 0.8 });
    const { play: playDefeat } = useSound('/sounds/cheese-thief/defeat.mp3', { volume: 0.8 });

    const sortedPlayers = [...gameState.players].sort((a, b) => {
        const votesA = gameState.vote_counts[a.id] || 0;
        const votesB = gameState.vote_counts[b.id] || 0;
        return votesB - votesA;
    });

    const isThief = gameState.is_thief;
    const isAccomplice = gameState.is_accomplice;
    const playerWon = winner === 'thief' ? (isThief || isAccomplice) : (!isThief && !isAccomplice);

    useEffect(() => {
        if (playerWon) {
            playVictory();
        } else {
            playDefeat();
        }
    }, [playerWon]);

    const handleReset = () => {
        if (isResetting) {
            return;
        }
        router.post(
            route('rooms.resetGame', [gameSlug, roomCode]),
            {},
            {
                onStart: () => setIsResetting(true),
                onFinish: () => setIsResetting(false),
            },
        );
    };

    return (
        <div className="flex flex-col items-center gap-5">
            {/* Winner banner */}
            <div
                className={`
                    w-full rounded-2xl p-6 text-center
                    ${winner === 'mice'
                        ? 'bg-linear-to-br from-blue-100 to-emerald-100'
                        : 'bg-linear-to-br from-red-100 to-orange-100'}
                `}
            >
                <div className="text-5xl mb-2">
                    {winner === 'mice' ? '\u{1F389}' : '\u{1F977}'}
                </div>
                <h2 className="text-3xl font-bold text-gray-900">
                    {winner === 'mice' ? 'Innocent Mice WIN!' : 'The Thief Wins!'}
                </h2>
                <p className="mt-1 text-base text-gray-700">
                    {winner === 'mice' ? 'The thief was caught!' : 'The thief escaped with the cheese!'}
                </p>
            </div>

            <div
                className={`
                    rounded-xl px-6 py-3 text-center
                    ${playerWon ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}
                `}
            >
                <p className="font-semibold">
                    {playerWon ? '\u{1F389} You Won!' : '\u{1F61E} You Lost!'}
                </p>
                <p className="text-sm mt-0.5">
                    You were: {isThief ? 'The Thief \u{1F977}' : isAccomplice ? 'The Accomplice \u{1F91D}' : 'An Innocent Mouse \u{1F401}'}
                </p>
            </div>

            <GameTable
                players={gameState.players}
                currentPlayerId={gameState.current_player_id}
                awakePlayerIds={[]}
                currentHour={gameState.current_hour}
                showDice={true}
            >
                <div className="flex flex-col items-center justify-center gap-3 rounded-3xl bg-slate-900/70 p-4 text-center shadow-inner ring-1 ring-amber-200/20">
                    <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-200/85">
                        Roles revealed
                    </span>
                    <div className="flex items-center justify-center gap-4">
                        <div className="flex flex-col items-center">
                            <div
                                className="flex h-12 w-12 items-center justify-center rounded-full text-base font-bold text-white shadow"
                                style={{ backgroundColor: thiefPlayer?.avatar_color }}
                            >
                                {thiefPlayer?.nickname.charAt(0).toUpperCase()}
                            </div>
                            <p className="mt-1 text-xs font-medium text-slate-100">{thiefPlayer?.nickname}</p>
                            <p className="text-[10px] text-red-300">{'\u{1F977}'} Thief</p>
                        </div>
                        {accomplicePlayer && (
                            <div className="flex flex-col items-center">
                                <div
                                    className="flex h-12 w-12 items-center justify-center rounded-full text-base font-bold text-white shadow"
                                    style={{ backgroundColor: accomplicePlayer.avatar_color }}
                                >
                                    {accomplicePlayer.nickname.charAt(0).toUpperCase()}
                                </div>
                                <p className="mt-1 text-xs font-medium text-slate-100">{accomplicePlayer.nickname}</p>
                                <p className="text-[10px] text-orange-300">{'\u{1F91D}'} Accomplice</p>
                            </div>
                        )}
                    </div>
                </div>
            </GameTable>

            {/* Vote results */}
            <div className="w-full rounded-xl bg-white p-5 shadow-sm dark:bg-gray-800">
                <h3 className="mb-3 text-center text-base font-semibold text-gray-700 dark:text-gray-300">
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
                                    className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
                                    style={{ backgroundColor: player.avatar_color }}
                                >
                                    {player.nickname.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1">
                                    <div className="mb-1 flex items-center justify-between">
                                        <span className="text-sm font-medium dark:text-gray-200">
                                            {player.nickname}
                                            {isThiefPlayer && ' \u{1F977}'}
                                            {player.is_accomplice && ' \u{1F91D}'}
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            {votes} vote{votes !== 1 ? 's' : ''}
                                            {wasCaught && ' ← CAUGHT!'}
                                        </span>
                                    </div>
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                                        <div
                                            className={`h-full transition-all duration-500 ${
                                                wasCaught ? 'bg-emerald-500' : isThiefPlayer ? 'bg-red-400' : 'bg-indigo-400'
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

            {gameState.isHost && (
                <button
                    onClick={handleReset}
                    disabled={isResetting}
                    className="rounded-xl bg-indigo-600 px-8 py-4 font-semibold text-white shadow-lg hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isResetting ? 'Resetting…' : 'Play Again'}
                </button>
            )}
        </div>
    );
}
