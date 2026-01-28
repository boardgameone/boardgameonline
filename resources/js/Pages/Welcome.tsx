import { Game, PageProps } from '@/types';
import { Head, Link } from '@inertiajs/react';

interface Props extends PageProps {
    featuredGames: Game[];
}

export default function Welcome({ auth, featuredGames }: Props) {
    return (
        <>
            <Head title="Board Game Online" />
            <div className="h-screen bg-yellow-400 flex flex-col overflow-hidden">
                {/* Nav */}
                <nav className="flex items-center justify-between p-4 sm:p-6 shrink-0">
                    <img
                        src="/images/logo.png"
                        alt="Board Game Online"
                        className="h-10 sm:h-12 w-auto drop-shadow-lg"
                    />
                    <div className="flex gap-2 sm:gap-3">
                        {auth.user ? (
                            <Link
                                href={route('dashboard')}
                                className="rounded-full bg-white px-4 sm:px-6 py-2 font-bold text-yellow-600 shadow-lg transition hover:scale-105 border-b-4 border-yellow-500 text-sm sm:text-base"
                            >
                                Dashboard
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href={route('login')}
                                    className="rounded-full bg-white px-4 sm:px-6 py-2 font-bold text-yellow-600 shadow-lg transition hover:scale-105 border-b-4 border-yellow-500 text-sm sm:text-base"
                                >
                                    Log in
                                </Link>
                                <Link
                                    href={route('register')}
                                    className="rounded-full bg-blue-600 px-4 sm:px-6 py-2 font-bold text-white shadow-lg transition hover:scale-105 hover:bg-blue-700 border-b-4 border-blue-800 text-sm sm:text-base"
                                >
                                    Register
                                </Link>
                            </>
                        )}
                    </div>
                </nav>

                {/* Main content */}
                <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 min-h-0">
                    {/* Title */}
                    <div className="text-center mb-6">
                        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white drop-shadow-[2px_2px_0px_rgba(0,0,0,0.2)]">
                            Board Game{' '}
                            <span className="text-blue-600 drop-shadow-[2px_2px_0px_rgba(255,255,255,0.5)]">
                                Online
                            </span>
                        </h1>
                        <p className="text-base sm:text-lg text-yellow-900 font-medium mt-2">
                            Play with friends. No downloads required.
                        </p>
                    </div>

                    {/* Games Grid */}
                    <div className="w-full max-w-3xl mb-6">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                            {featuredGames.map((game) => (
                                <GameCard key={game.id} game={game} />
                            ))}
                            {featuredGames.length < 4 &&
                                Array.from({ length: 4 - featuredGames.length }).map((_, i) => (
                                    <ComingSoonCard key={`coming-${i}`} />
                                ))}
                        </div>
                    </div>

                    {/* CTA */}
                    <div className="flex flex-col sm:flex-row gap-3 mb-4">
                        <Link
                            href={route('games.index')}
                            className="rounded-full bg-blue-600 px-8 py-3 text-base font-bold text-white shadow-xl transition hover:scale-105 hover:bg-blue-700 border-b-4 border-blue-800"
                        >
                            Browse All Games
                        </Link>
                        <Link
                            href={route('rooms.join')}
                            className="rounded-full bg-white px-8 py-3 text-base font-bold text-yellow-600 shadow-xl transition hover:scale-105 border-b-4 border-yellow-500"
                        >
                            Join Room
                        </Link>
                    </div>
                </main>

                {/* Footer */}
                <footer className="p-3 text-center text-yellow-800 font-medium text-sm shrink-0">
                    Play together, anywhere!
                </footer>
            </div>
        </>
    );
}

function TrioGameVisualSmall() {
    return (
        <div className="relative group-hover:scale-110 transition-transform duration-300">
            {/* Three overlapping cards showing a trio */}
            <div className="relative flex items-center justify-center">
                {/* Card 1 - Left */}
                <div className="absolute -left-6 sm:-left-8 w-12 sm:w-16 h-16 sm:h-20 bg-white rounded-lg shadow-xl border-2 border-white/80 flex flex-col items-center justify-center transform -rotate-12 group-hover:-rotate-[16deg] transition-transform duration-300">
                    <div className="text-2xl sm:text-3xl font-black text-purple-600">7</div>
                    <div className="text-purple-400 text-[0.4rem] sm:text-[0.5rem] font-bold">★★★</div>
                </div>

                {/* Card 2 - Center */}
                <div className="relative w-12 sm:w-16 h-16 sm:h-20 bg-white rounded-lg shadow-xl border-2 border-white/80 flex flex-col items-center justify-center z-10 group-hover:scale-110 transition-transform duration-300">
                    <div className="text-2xl sm:text-3xl font-black text-indigo-600">7</div>
                    <div className="text-indigo-400 text-[0.4rem] sm:text-[0.5rem] font-bold">★★★</div>
                </div>

                {/* Card 3 - Right */}
                <div className="absolute -right-6 sm:-right-8 w-12 sm:w-16 h-16 sm:h-20 bg-white rounded-lg shadow-xl border-2 border-white/80 flex flex-col items-center justify-center transform rotate-12 group-hover:rotate-[16deg] transition-transform duration-300">
                    <div className="text-2xl sm:text-3xl font-black text-pink-600">7</div>
                    <div className="text-pink-400 text-[0.4rem] sm:text-[0.5rem] font-bold">★★★</div>
                </div>
            </div>
        </div>
    );
}

function GameCard({ game }: { game: Game }) {
    const gameEmoji = getGameEmoji(game.slug);
    const gradients: Record<string, string> = {
        'cheese-thief': 'from-amber-600 to-amber-800',
        'trio': 'from-blue-500 via-cyan-500 to-teal-500',
    };
    const gradient = gradients[game.slug] || 'from-amber-600 to-amber-800';

    return (
        <Link
            href={route('games.show', game.slug)}
            className="bg-white rounded-xl shadow-lg overflow-hidden transition hover:scale-105 hover:shadow-xl group"
        >
            <div className={`aspect-square bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                {game.slug === 'trio' ? (
                    <TrioGameVisualSmall />
                ) : (
                    <span className={`text-4xl sm:text-5xl ${game.slug === 'cheese-thief' ? '-rotate-90' : ''}`}>{gameEmoji}</span>
                )}
            </div>
            <div className="p-2 sm:p-3 text-center">
                <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate">{game.name}</h3>
                <p className="text-xs text-gray-500">{game.min_players}-{game.max_players} players</p>
            </div>
        </Link>
    );
}

function ComingSoonCard() {
    return (
        <div className="bg-white/50 rounded-xl shadow-lg overflow-hidden">
            <div className="aspect-square bg-gray-200 flex items-center justify-center">
                <span className="text-3xl sm:text-4xl opacity-40">{'\u{2753}'}</span>
            </div>
            <div className="p-2 sm:p-3 text-center">
                <h3 className="font-bold text-gray-400 text-sm sm:text-base">Coming Soon</h3>
                <p className="text-xs text-gray-400">Stay tuned!</p>
            </div>
        </div>
    );
}

function getGameEmoji(slug: string): string {
    const emojis: Record<string, string> = {
        'cheese-thief': '\u{1F9C0}',
        'trio': '\u{1F0CF}',
    };
    return emojis[slug] || '\u{1F3B2}';
}
