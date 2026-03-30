interface TwentyEightTutorialProps {
    show: boolean;
    onClose: () => void;
}

export default function TwentyEightTutorial({ show, onClose }: TwentyEightTutorialProps) {
    if (!show) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div
                className="bg-white rounded-2xl p-6 shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-black text-gray-900">
                        How to Play Twenty-Eight
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-4 text-sm text-gray-700">
                    <Section title="Overview">
                        <p>Twenty-Eight is a 4-player trick-taking card game played in teams of 2. Partners sit opposite each other.</p>
                    </Section>

                    <Section title="Cards & Points">
                        <p>Uses 32 cards (8 per suit). Card ranking and points:</p>
                        <div className="mt-2 grid grid-cols-4 gap-1 text-center text-xs">
                            {[
                                { rank: 'J', pts: 3, str: 'Highest' },
                                { rank: '9', pts: 2, str: '' },
                                { rank: 'A', pts: 1, str: '' },
                                { rank: '10', pts: 1, str: '' },
                                { rank: 'K', pts: 0, str: '' },
                                { rank: 'Q', pts: 0, str: '' },
                                { rank: '8', pts: 0, str: '' },
                                { rank: '7', pts: 0, str: 'Lowest' },
                            ].map(c => (
                                <div key={c.rank} className="bg-gray-50 rounded p-1.5">
                                    <div className="font-bold text-gray-900">{c.rank}</div>
                                    <div className="text-amber-600 font-bold">{c.pts}pt{c.pts !== 1 ? 's' : ''}</div>
                                </div>
                            ))}
                        </div>
                        <p className="mt-2 text-amber-700 font-medium">Total: 28 points in the deck</p>
                    </Section>

                    <Section title="Dealing">
                        <p>4 cards dealt first. After bidding, 4 more cards are dealt (8 total per player).</p>
                    </Section>

                    <Section title="Bidding">
                        <p>Starting from the player right of the dealer, players bid (14-28) or pass. The highest bidder chooses a <strong>hidden trump</strong> suit from their initial 4 cards.</p>
                    </Section>

                    <Section title="Playing Tricks">
                        <ul className="list-disc list-inside space-y-1">
                            <li>The bid winner leads the first trick</li>
                            <li>You <strong>must follow suit</strong> if you can</li>
                            <li>If you can't follow suit, you may <strong>call trump</strong> to reveal the hidden trump suit</li>
                            <li>After trump is revealed, trump cards beat all other suits</li>
                            <li>The trick winner leads the next trick</li>
                        </ul>
                    </Section>

                    <Section title="Scoring">
                        <ul className="list-disc list-inside space-y-1">
                            <li>After 8 tricks, count points won by each team</li>
                            <li>If the bidding team meets their bid: +1 game point</li>
                            <li>If they don't: -1 game point</li>
                            <li>First team to <strong>+6 or -6</strong> game points ends the game</li>
                        </ul>
                    </Section>
                </div>

                <button
                    onClick={onClose}
                    className="mt-6 w-full py-2.5 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600 transition"
                >
                    Got it!
                </button>
            </div>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <h4 className="font-bold text-gray-900 mb-1">{title}</h4>
            {children}
        </div>
    );
}
