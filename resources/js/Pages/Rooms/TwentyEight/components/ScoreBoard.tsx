interface ScoreBoardProps {
    points: { team_a: number; team_b: number };
    gameScores: { team_a: number; team_b: number };
    bidValue: number;
    bidTeam: 'team_a' | 'team_b' | null;
    tricksWon: { team_a: number; team_b: number };
    compact?: boolean;
}

export default function ScoreBoard({
    points,
    gameScores,
    bidValue,
    bidTeam,
    tricksWon,
    compact = false,
}: ScoreBoardProps) {
    if (compact) {
        return (
            <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                    <span className="font-bold text-blue-700 dark:text-blue-300">{points.team_a}pts</span>
                    <span className="text-gray-400 dark:text-gray-500">({gameScores.team_a})</span>
                </div>
                <div className="text-gray-300 dark:text-gray-600">|</div>
                <div className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-rose-500" />
                    <span className="font-bold text-rose-700 dark:text-rose-300">{points.team_b}pts</span>
                    <span className="text-gray-400 dark:text-gray-500">({gameScores.team_b})</span>
                </div>
                {bidTeam && (
                    <>
                        <div className="text-gray-300 dark:text-gray-600">|</div>
                        <span className="text-gray-500 dark:text-gray-400">Bid: {bidValue}</span>
                    </>
                )}
            </div>
        );
    }

    return (
        <div className="rounded-xl bg-white border border-gray-200 shadow-xs overflow-hidden dark:bg-gray-800 dark:border-gray-700">
            <div className="grid grid-cols-2 divide-x divide-gray-200 dark:divide-gray-700">
                <TeamScore
                    label="Team A"
                    color="blue"
                    points={points.team_a}
                    gameScore={gameScores.team_a}
                    tricks={tricksWon.team_a}
                    isBidTeam={bidTeam === 'team_a'}
                    bidValue={bidValue}
                />
                <TeamScore
                    label="Team B"
                    color="rose"
                    points={points.team_b}
                    gameScore={gameScores.team_b}
                    tricks={tricksWon.team_b}
                    isBidTeam={bidTeam === 'team_b'}
                    bidValue={bidValue}
                />
            </div>
        </div>
    );
}

function TeamScore({
    label,
    color,
    points,
    gameScore,
    tricks,
    isBidTeam,
    bidValue,
}: {
    label: string;
    color: 'blue' | 'rose';
    points: number;
    gameScore: number;
    tricks: number;
    isBidTeam: boolean;
    bidValue: number;
}) {
    const bgClass = color === 'blue' ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-rose-50 dark:bg-rose-900/20';
    const textClass = color === 'blue' ? 'text-blue-700 dark:text-blue-300' : 'text-rose-700 dark:text-rose-300';
    const dotClass = color === 'blue' ? 'bg-blue-500' : 'bg-rose-500';
    const badgeClass = color === 'blue'
        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
        : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300';

    return (
        <div className={`p-3 ${bgClass}`}>
            <div className="flex items-center gap-1.5 mb-2">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotClass}`} />
                <span className={`text-sm font-bold ${textClass}`}>{label}</span>
                {isBidTeam && (
                    <span className={`text-[0.6rem] px-1.5 py-0.5 rounded-full font-bold ${badgeClass}`}>
                        Bid {bidValue}
                    </span>
                )}
            </div>
            <div className="space-y-1">
                <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Points</span>
                    <span className={`text-lg font-black ${textClass}`}>{points}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Tricks</span>
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{tricks}</span>
                </div>
                <div className="flex justify-between items-center border-t border-gray-200 pt-1 mt-1 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Game Score</span>
                    <span className={`text-sm font-black ${gameScore >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {gameScore > 0 ? '+' : ''}{gameScore}
                    </span>
                </div>
            </div>
        </div>
    );
}
