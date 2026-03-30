import { router } from '@inertiajs/react';
import { TwentyEightGameState } from '@/types';
import ScoreBoard from './components/ScoreBoard';
import GameIcon from '@/Components/GameIcon';

interface RoundEndPhaseProps {
    gameState: TwentyEightGameState;
    roomCode: string;
    gameSlug: string;
    isHost: boolean;
}

export default function RoundEndPhase({
    gameState,
    roomCode,
    gameSlug,
    isHost,
}: RoundEndPhaseProps) {
    const bidTeam = gameState.bid_team;
    const defendTeam = bidTeam === 'team_a' ? 'team_b' : 'team_a';
    const bidTeamPoints = gameState.points[bidTeam ?? 'team_a'];
    const bidValue = gameState.bid_value;
    const bidTeamWon = bidTeamPoints >= bidValue;

    const bidTeamLabel = bidTeam === 'team_a' ? 'Team A' : 'Team B';
    const defendTeamLabel = defendTeam === 'team_a' ? 'Team A' : 'Team B';

    const handleNextRound = () => {
        router.post(route('rooms.twentyEight.nextRound', [gameSlug, roomCode]));
    };

    return (
        <div className="max-w-lg mx-auto space-y-6">
            {/* Result banner */}
            <div className={`rounded-2xl p-6 text-center shadow-lg ${
                bidTeamWon
                    ? 'bg-gradient-to-br from-green-50 to-emerald-100 border-2 border-green-300'
                    : 'bg-gradient-to-br from-red-50 to-rose-100 border-2 border-red-300'
            }`}>
                <div className="text-4xl mb-2">
                    {bidTeamWon ? '\uD83C\uDF89' : '\uD83D\uDE14'}
                </div>
                <h2 className="text-xl font-black text-gray-900 mb-1">
                    Round {gameState.round_number} Complete
                </h2>
                <p className={`text-lg font-bold ${bidTeamWon ? 'text-green-700' : 'text-red-700'}`}>
                    {bidTeamLabel} {bidTeamWon ? 'made' : 'missed'} their bid!
                </p>
                <p className="text-sm text-gray-600 mt-1">
                    Bid: {bidValue} &middot; Won: {bidTeamPoints} points
                </p>
            </div>

            {/* Points breakdown */}
            <div className="rounded-xl bg-white shadow-md border border-gray-200 p-4">
                <h4 className="text-sm font-bold text-gray-600 mb-3">Round Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-center">
                    <div className={`p-3 rounded-lg ${bidTeam === 'team_a' ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}>
                        <div className="text-xs text-gray-500 mb-1">Team A Points</div>
                        <div className="text-2xl font-black text-blue-700">{gameState.points.team_a}</div>
                        <div className="text-xs text-gray-400">of 28</div>
                    </div>
                    <div className={`p-3 rounded-lg ${bidTeam === 'team_b' ? 'bg-rose-50 border border-rose-200' : 'bg-gray-50'}`}>
                        <div className="text-xs text-gray-500 mb-1">Team B Points</div>
                        <div className="text-2xl font-black text-rose-700">{gameState.points.team_b}</div>
                        <div className="text-xs text-gray-400">of 28</div>
                    </div>
                </div>
            </div>

            {/* Game scores */}
            <ScoreBoard
                points={gameState.points}
                gameScores={gameState.game_scores}
                bidValue={gameState.bid_value}
                bidTeam={gameState.bid_team}
                tricksWon={gameState.tricks_won}
            />

            {/* Score progress bar */}
            <div className="rounded-xl bg-white shadow-md border border-gray-200 p-4">
                <h4 className="text-sm font-bold text-gray-600 mb-3">Game Progress (first to +6 or -6)</h4>
                <div className="space-y-3">
                    <ScoreBar label="Team A" score={gameState.game_scores.team_a} color="blue" />
                    <ScoreBar label="Team B" score={gameState.game_scores.team_b} color="rose" />
                </div>
            </div>

            {/* Next round button */}
            {isHost && (
                <button
                    onClick={handleNextRound}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-lg shadow-lg hover:from-amber-600 hover:to-amber-700 transition-all hover:scale-105 active:scale-95 border-b-4 border-amber-700"
                >
                    <GameIcon name="gamepad" className="inline-block mr-1" /> Next Round
                </button>
            )}

            {!isHost && (
                <div className="text-center text-gray-500 text-sm">
                    Waiting for host to start the next round...
                </div>
            )}
        </div>
    );
}

function ScoreBar({ label, score, color }: { label: string; score: number; color: 'blue' | 'rose' }) {
    const percentage = Math.min(Math.abs(score) / 6 * 100, 100);
    const isPositive = score >= 0;
    const bgClass = color === 'blue' ? 'bg-blue-200' : 'bg-rose-200';
    const fillClass = isPositive
        ? (color === 'blue' ? 'bg-blue-500' : 'bg-rose-500')
        : 'bg-red-500';
    const textClass = color === 'blue' ? 'text-blue-700' : 'text-rose-700';

    return (
        <div>
            <div className="flex justify-between text-xs mb-1">
                <span className={`font-bold ${textClass}`}>{label}</span>
                <span className={`font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {score > 0 ? '+' : ''}{score}/6
                </span>
            </div>
            <div className={`h-3 rounded-full ${bgClass} overflow-hidden`}>
                <div
                    className={`h-full rounded-full ${fillClass} transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}
