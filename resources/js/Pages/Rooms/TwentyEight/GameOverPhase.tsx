import { router } from '@inertiajs/react';
import { TwentyEightGameState } from '@/types';
import GameIcon from '@/Components/GameIcon';

interface GameOverPhaseProps {
    gameState: TwentyEightGameState;
    roomCode: string;
    gameSlug: string;
    isHost: boolean;
    currentPlayerId?: number;
}

export default function GameOverPhase({
    gameState,
    roomCode,
    gameSlug,
    isHost,
    currentPlayerId,
}: GameOverPhaseProps) {
    const teamAWon = gameState.game_scores.team_a >= 6;
    const teamBWon = gameState.game_scores.team_b >= 6;
    const winningTeam = teamAWon ? 'team_a' : teamBWon ? 'team_b' : (gameState.game_scores.team_a <= -6 ? 'team_b' : 'team_a');

    const myPlayer = gameState.players.find(p => p.id === currentPlayerId);
    const didWin = myPlayer?.team === winningTeam;

    const winningTeamLabel = winningTeam === 'team_a' ? 'Team A' : 'Team B';
    const winningPlayers = gameState.players.filter(p => p.team === winningTeam);
    const losingPlayers = gameState.players.filter(p => p.team !== winningTeam);

    const handlePlayAgain = () => {
        router.post(route('rooms.resetGame', [gameSlug, roomCode]));
    };

    return (
        <div className="max-w-lg mx-auto space-y-6 py-4">
            {/* Winner banner */}
            <div className={`rounded-2xl p-8 text-center shadow-xl ${
                didWin
                    ? 'bg-gradient-to-br from-amber-100 via-yellow-100 to-amber-200 border-2 border-amber-400 dark:from-amber-900/30 dark:via-yellow-900/30 dark:to-amber-800/30 dark:border-amber-600'
                    : 'bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-gray-300 dark:from-gray-800 dark:to-gray-900 dark:border-gray-700'
            }`}>
                <div className="text-5xl mb-3">
                    {didWin ? '\uD83C\uDFC6' : '\uD83D\uDC4F'}
                </div>
                <h2 className="text-2xl font-black text-gray-900 mb-2 dark:text-gray-100">
                    {didWin ? 'You Won!' : 'Game Over'}
                </h2>
                <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
                    {winningTeamLabel} Wins!
                </p>
                <p className="text-sm text-gray-600 mt-2 dark:text-gray-400">
                    Final Score: Team A {gameState.game_scores.team_a} - Team B {gameState.game_scores.team_b}
                </p>
            </div>

            {/* Winning team */}
            <div className="rounded-xl bg-gradient-to-br from-amber-50 to-yellow-50 shadow-md border border-amber-200 p-5 dark:from-amber-900/20 dark:to-yellow-900/20 dark:border-amber-800">
                <h4 className="text-sm font-bold text-amber-700 mb-3 text-center dark:text-amber-300">Winners</h4>
                <div className="flex justify-center gap-4">
                    {winningPlayers.map(player => (
                        <div key={player.id} className="text-center">
                            <div
                                className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg mx-auto mb-1 ring-2 ring-amber-400 ring-offset-2 dark:ring-offset-gray-800"
                                style={{ backgroundColor: player.avatar_color }}
                            >
                                {player.nickname.charAt(0).toUpperCase()}
                            </div>
                            <div className="text-sm font-bold text-gray-800 dark:text-gray-200">{player.nickname}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Round history */}
            {gameState.round_history.length > 0 && (
                <div className="rounded-xl bg-white shadow-md border border-gray-200 p-4 dark:bg-gray-800 dark:border-gray-700">
                    <h4 className="text-sm font-bold text-gray-600 mb-3 dark:text-gray-400">Round History</h4>
                    <div className="space-y-2">
                        {gameState.round_history.map((round, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg p-2 dark:bg-gray-900/40">
                                <span className="font-medium text-gray-600 dark:text-gray-400">R{round.round_number}</span>
                                <span className="text-gray-500 dark:text-gray-400">
                                    Bid: {round.bid_value} ({round.bid_team === 'team_a' ? 'A' : 'B'})
                                </span>
                                <div className="flex gap-2">
                                    <span className="text-blue-600 font-bold dark:text-blue-400">A: {round.points.team_a}</span>
                                    <span className="text-rose-600 font-bold dark:text-rose-400">B: {round.points.team_b}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Play again button */}
            {isHost && (
                <button
                    onClick={handlePlayAgain}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-black text-lg shadow-lg hover:from-amber-600 hover:to-amber-700 transition-all hover:scale-105 active:scale-95 border-b-4 border-amber-700"
                >
                    <GameIcon name="gamepad" className="inline-block mr-1" /> Play Again
                </button>
            )}

            {!isHost && (
                <div className="text-center text-gray-500 text-sm dark:text-gray-400">
                    Waiting for host to start a new game...
                </div>
            )}
        </div>
    );
}
