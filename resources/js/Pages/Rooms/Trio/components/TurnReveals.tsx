import TrioCard from './TrioCard';

interface Reveal {
    value: number;
    source: string;
    reveal_type: string;
}

interface Player {
    id: number;
    nickname: string;
}

interface TurnRevealsProps {
    reveals: Reveal[];
    players: Player[];
    canClaim: boolean;
    canEndTurn: boolean;
    canContinue: boolean;
    onClaimTrio: () => void;
    onEndTurn: () => void;
}

export default function TurnReveals({
    reveals,
    players,
    canClaim,
    canEndTurn,
    canContinue,
    onClaimTrio,
    onEndTurn,
}: TurnRevealsProps) {
    if (reveals.length === 0) {
        return null;
    }

    const getRevealSource = (reveal: Reveal) => {
        if (reveal.source.startsWith('player_')) {
            const playerId = parseInt(reveal.source.replace('player_', ''));
            const player = players.find(p => p.id === playerId);
            const revealLabel = reveal.reveal_type === 'ask_highest' ? 'High' : 'Low';
            return `${revealLabel}: ${player?.nickname || 'Unknown'}`;
        }
        return 'Middle';
    };

    const isTrioValid = reveals.length === 3;
    const borderColor = isTrioValid && canClaim ? 'border-green-500' : 'border-blue-200';

    return (
        <div className={`rounded-xl bg-white p-6 shadow-lg border-2 ${borderColor} animate-slideIn`}>
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span>Current Turn Reveals</span>
                {isTrioValid && canClaim && (
                    <span className="text-green-600 animate-pulse">✨</span>
                )}
            </h3>

            {/* Horizontal scrollable cards */}
            <div className="flex gap-4 overflow-x-auto pb-2 mb-4">
                {reveals.map((reveal, idx) => (
                    <div
                        key={idx}
                        className="flex flex-col items-center flex-shrink-0 animate-slideIn"
                        style={{ animationDelay: `${idx * 100}ms` }}
                    >
                        <TrioCard
                            value={reveal.value}
                            faceUp={true}
                            size="sm"
                            variant="indigo"
                        />
                        <span className="text-xs text-gray-600 mt-2 text-center max-w-[100px] font-medium">
                            {getRevealSource(reveal)}
                        </span>
                    </div>
                ))}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
                {canClaim && (
                    <button
                        onClick={onClaimTrio}
                        className="flex-1 rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-6 py-3 text-white font-bold shadow-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 hover:scale-105 active:scale-95 border-b-4 border-green-700"
                    >
                        🎉 Claim Trio!
                    </button>
                )}
                {canEndTurn && !canContinue && (
                    <button
                        onClick={onEndTurn}
                        className="flex-1 rounded-lg bg-gradient-to-r from-red-500 to-red-600 px-6 py-3 text-white font-bold shadow-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 hover:scale-105 active:scale-95 border-b-4 border-red-700 animate-shake"
                    >
                        ❌ End Turn
                    </button>
                )}
            </div>

            {!canContinue && reveals.length > 0 && !canClaim && (
                <p className="mt-3 text-sm text-red-600 font-medium text-center">
                    Cards don't match - end your turn
                </p>
            )}
        </div>
    );
}
