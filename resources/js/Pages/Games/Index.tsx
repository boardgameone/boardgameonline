import GameLayout from '@/Layouts/GameLayout';
import { Game, PageProps } from '@/types';
import { Head, Link } from '@inertiajs/react';

interface Props extends PageProps {
    games: Game[];
}

export default function Index({ games }: Props) {
    return (
        <GameLayout>
            <Head title="Games" />

            {/* Hero Header */}
            <div className="mb-10">
                <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                    {/* Decorative circles */}
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />

                    <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
                        <div className="text-center sm:text-left">
                            <div className="flex items-center gap-3 justify-center sm:justify-start">
                                <span className="text-5xl">{'\u{1F3AE}'}</span>
                                <h1 className="text-3xl sm:text-4xl font-black text-white">
                                    Game Library
                                </h1>
                            </div>
                            <p className="text-white/80 mt-2 text-lg">
                                Pick a game and start playing with friends!
                            </p>
                        </div>
                        <Link
                            href={route('rooms.join')}
                            className="rounded-full bg-white px-8 py-4 font-bold text-purple-600 shadow-lg transition hover:scale-105 border-b-4 border-purple-300 flex items-center gap-2"
                        >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            Join with Code
                        </Link>
                    </div>
                </div>
            </div>

            {/* Games Section Title */}
            <div className="mb-6 flex items-center gap-3">
                <div className="h-1 flex-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent rounded-full" />
                <h2 className="text-xl font-bold text-gray-700 flex items-center gap-2">
                    <span>{'\u{2B50}'}</span> Available Games <span>{'\u{2B50}'}</span>
                </h2>
                <div className="h-1 flex-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent rounded-full" />
            </div>

            {/* Games Grid */}
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {games.map((game) => (
                    <GameCard key={game.id} game={game} />
                ))}
            </div>

            {games.length === 0 && (
                <div className="text-center py-20">
                    <div className="inline-flex items-center justify-center w-32 h-32 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full mb-6 shadow-inner">
                        <span className="text-6xl opacity-40">{'\u{1F3B2}'}</span>
                    </div>
                    <p className="text-gray-600 font-bold text-xl">
                        No games available yet
                    </p>
                    <p className="text-gray-500 mt-2">
                        Check back soon for exciting new games!
                    </p>
                </div>
            )}
        </GameLayout>
    );
}

function TrioGameVisual() {
    return (
        <div className="relative z-10 group-hover:scale-110 transition-transform duration-500">
            {/* Three overlapping cards showing a trio */}
            <div className="relative flex items-center justify-center">
                {/* Card 1 - Left */}
                <div className="absolute -left-12 w-24 h-32 bg-white rounded-xl shadow-2xl border-4 border-white/80 flex flex-col items-center justify-center transform -rotate-12 group-hover:-rotate-[16deg] transition-transform duration-300">
                    <div className="text-5xl font-black text-purple-600">7</div>
                    <div className="mt-1 text-purple-400 text-xs font-bold">★★★</div>
                </div>

                {/* Card 2 - Center */}
                <div className="relative w-24 h-32 bg-white rounded-xl shadow-2xl border-4 border-white/80 flex flex-col items-center justify-center z-10 group-hover:scale-110 transition-transform duration-300">
                    <div className="text-5xl font-black text-indigo-600">7</div>
                    <div className="mt-1 text-indigo-400 text-xs font-bold">★★★</div>
                </div>

                {/* Card 3 - Right */}
                <div className="absolute -right-12 w-24 h-32 bg-white rounded-xl shadow-2xl border-4 border-white/80 flex flex-col items-center justify-center transform rotate-12 group-hover:rotate-[16deg] transition-transform duration-300">
                    <div className="text-5xl font-black text-pink-600">7</div>
                    <div className="mt-1 text-pink-400 text-xs font-bold">★★★</div>
                </div>
            </div>
        </div>
    );
}

function GameCard({ game }: Readonly<{ game: Game }>) {
    const gameEmoji = getGameEmoji(game.slug);
    const gradients: Record<string, string> = {
        'cheese-thief': 'from-amber-600 to-amber-800',
        'trio': 'from-blue-500 via-cyan-500 to-teal-500',
    };
    const gradient = gradients[game.slug] || 'from-amber-600 to-amber-800';

    return (
        <Link
            href={route('games.show', game.slug)}
            className="group relative bg-white rounded-3xl shadow-xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
        >
            {/* Game Image Area */}
            <div className={`aspect-[4/3] bg-gradient-to-br ${gradient} flex items-center justify-center relative overflow-hidden`}>
                {/* Animated background shapes */}
                <div className="absolute inset-0 opacity-30">
                    <div className="absolute top-4 left-4 w-16 h-16 bg-white/30 rounded-full animate-pulse" />
                    <div className="absolute bottom-8 right-8 w-24 h-24 bg-white/20 rounded-full" />
                    <div className="absolute top-1/2 left-1/2 w-12 h-12 bg-white/20 rounded-lg rotate-45 -translate-x-1/2 -translate-y-1/2" />
                </div>

                {/* Main game visual */}
                {game.slug === 'trio' ? (
                    <TrioGameVisual />
                ) : (
                    <span className={`text-8xl group-hover:scale-125 transition-transform duration-500 drop-shadow-lg relative z-10 ${game.slug === 'cheese-thief' ? '-rotate-90' : ''}`}>
                        {gameEmoji}
                    </span>
                )}

                {/* Play button overlay on hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
                    <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-50 group-hover:scale-100 shadow-lg">
                        <svg className="h-8 w-8 text-purple-600 ml-1" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </div>
                </div>

                {/* Active rooms badge */}
                {game.active_rooms_count !== undefined && game.active_rooms_count > 0 && (
                    <div className="absolute top-4 right-4 z-20">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500 text-white text-sm font-bold shadow-lg animate-pulse">
                            <span className="w-2 h-2 bg-white rounded-full" />
                            {game.active_rooms_count} Live
                        </span>
                    </div>
                )}
            </div>

            {/* Game Info */}
            <div className="p-6">
                <h3 className="text-2xl font-black text-gray-900 group-hover:text-purple-600 transition-colors">
                    {game.name}
                </h3>
                <p className="mt-2 text-gray-500 line-clamp-2 text-sm">
                    {game.description}
                </p>

                {/* Stats */}
                <div className="mt-5 flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-600 text-sm font-bold">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        {game.min_players}-{game.max_players} Players
                    </span>
                    {game.estimated_duration_minutes && (
                        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-50 text-purple-600 text-sm font-bold">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            ~{game.estimated_duration_minutes} min
                        </span>
                    )}
                </div>

                {/* Play Button */}
                <div className="mt-6">
                    <div className="w-full rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 font-bold text-white text-center shadow-lg group-hover:shadow-xl transition-all group-hover:from-blue-700 group-hover:to-purple-700">
                        Play Now {'\u{1F680}'}
                    </div>
                </div>
            </div>
        </Link>
    );
}

function getGameEmoji(slug: string): string {
    const emojis: Record<string, string> = {
        'cheese-thief': '\u{1F9C0}',
        'trio': '\u{1F0CF}',
    };
    return emojis[slug] || '\u{1F3B2}';
}
