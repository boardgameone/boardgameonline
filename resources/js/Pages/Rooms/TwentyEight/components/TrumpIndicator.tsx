const SUIT_SYMBOLS: Record<string, string> = {
    hearts: '\u2665',
    diamonds: '\u2666',
    clubs: '\u2663',
    spades: '\u2660',
};

const SUIT_COLORS: Record<string, string> = {
    hearts: 'text-red-600',
    diamonds: 'text-red-600',
    clubs: 'text-gray-900',
    spades: 'text-gray-900',
};

interface TrumpIndicatorProps {
    revealed: boolean;
    suit: string | null;
    compact?: boolean;
}

export default function TrumpIndicator({ revealed, suit, compact = false }: TrumpIndicatorProps) {
    if (compact) {
        return (
            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${
                revealed
                    ? 'bg-amber-100 border border-amber-300'
                    : 'bg-gray-100 border border-gray-300'
            }`}>
                <span className="text-gray-500">Trump:</span>
                {revealed && suit ? (
                    <span className={`text-base ${SUIT_COLORS[suit]}`}>
                        {SUIT_SYMBOLS[suit]}
                    </span>
                ) : (
                    <span className="text-gray-400">Hidden</span>
                )}
            </div>
        );
    }

    return (
        <div className={`rounded-xl p-3 text-center ${
            revealed
                ? 'bg-linear-to-br from-amber-50 to-yellow-100 border-2 border-amber-300'
                : 'bg-linear-to-br from-gray-50 to-gray-100 border-2 border-gray-300'
        }`}>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                Trump
            </div>
            {revealed && suit ? (
                <div className={`text-4xl ${SUIT_COLORS[suit]}`}>
                    {SUIT_SYMBOLS[suit]}
                </div>
            ) : (
                <div className="flex justify-center">
                    <div className="w-10 h-14 rounded-md bg-linear-to-br from-blue-600 to-blue-800 border border-blue-900 flex items-center justify-center">
                        <span className="text-white/60 text-lg">?</span>
                    </div>
                </div>
            )}
        </div>
    );
}
