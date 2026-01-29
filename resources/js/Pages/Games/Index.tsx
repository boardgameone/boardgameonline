import GameLayout from '@/Layouts/GameLayout';
import { Game, PageProps } from '@/types';
import { Head, Link } from '@inertiajs/react';
import GameIcon from '@/Components/GameIcon';

interface Props extends PageProps {
    games: Game[];
}

export default function Index({ games }: Props) {
    return (
        <GameLayout fullHeight>
            <Head title="Games" />

            {/* Mobile Layout - vertical stacking with scroll */}
            <div className="h-full flex flex-col gap-4 p-3 lg:hidden overflow-auto">
                {/* Compact Hero Header */}
                <div className="rounded-2xl bg-gradient-to-r from-brand-blue to-brand-teal p-4 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-2">
                            <GameIcon name="gamepad" size="lg" className="text-white" />
                            <h1 className="text-2xl font-black text-white">Game Library</h1>
                        </div>
                        <p className="text-white/80 mt-1 text-sm">
                            Pick a game and start playing!
                        </p>
                        <Link
                            href={route('rooms.join')}
                            className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 font-bold text-brand-teal shadow-md text-sm"
                        >
                            <LinkIcon className="h-4 w-4" />
                            Join with Code
                        </Link>
                    </div>
                </div>

                {/* Games Grid - Mobile */}
                <div className="flex-1">
                    {games.length > 0 ? (
                        <div className="grid gap-4 sm:grid-cols-2">
                            {games.map((game) => (
                                <GameCardCompact key={game.id} game={game} />
                            ))}
                        </div>
                    ) : (
                        <EmptyState />
                    )}
                </div>
            </div>

            {/* Desktop Layout - full viewport */}
            <div className="hidden lg:flex lg:flex-col h-full p-4 gap-4">
                {/* Compact Hero Header */}
                <div className="rounded-2xl bg-gradient-to-r from-brand-blue to-brand-teal p-5 shadow-lg relative overflow-hidden flex-shrink-0">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />

                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-3">
                                <GameIcon name="gamepad" size="xl" className="text-white" />
                                <h1 className="text-3xl font-black text-white">Game Library</h1>
                            </div>
                            <p className="text-white/80 mt-1">
                                Pick a game and start playing with friends!
                            </p>
                        </div>
                        <Link
                            href={route('rooms.join')}
                            className="rounded-full bg-white px-6 py-3 font-bold text-brand-teal shadow-lg transition hover:scale-105 border-b-4 border-teal-200 flex items-center gap-2"
                        >
                            <LinkIcon className="h-5 w-5" />
                            Join with Code
                        </Link>
                    </div>
                </div>

                {/* Games Grid - Desktop */}
                <div className="flex-1 overflow-y-auto min-h-0">
                    {games.length > 0 ? (
                        <div className="grid gap-5 grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 auto-rows-max">
                            {games.map((game) => (
                                <GameCard key={game.id} game={game} />
                            ))}
                        </div>
                    ) : (
                        <EmptyState />
                    )}
                </div>
            </div>
        </GameLayout>
    );
}

function EmptyState() {
    return (
        <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full mb-4 shadow-inner">
                <GameIcon name="dice" size="xl" className="opacity-40 text-gray-500" />
            </div>
            <p className="text-gray-600 font-bold text-lg">No games available yet</p>
            <p className="text-gray-500 mt-1 text-sm">Check back soon for exciting new games!</p>
        </div>
    );
}

function TrioGameVisual() {
    return (
        <div className="relative z-10 group-hover:scale-110 transition-transform duration-500">
            <div className="relative flex items-center justify-center">
                <div className="absolute -left-10 w-20 h-28 bg-white rounded-xl shadow-xl border-2 border-white/80 flex flex-col items-center justify-center transform -rotate-12 group-hover:-rotate-[16deg] transition-transform duration-300">
                    <div className="text-4xl font-black text-brand-teal">7</div>
                    <div className="text-teal-400 text-xs font-bold">★★★</div>
                </div>
                <div className="relative w-20 h-28 bg-white rounded-xl shadow-xl border-2 border-white/80 flex flex-col items-center justify-center z-10 group-hover:scale-110 transition-transform duration-300">
                    <div className="text-4xl font-black text-brand-blue">7</div>
                    <div className="text-blue-400 text-xs font-bold">★★★</div>
                </div>
                <div className="absolute -right-10 w-20 h-28 bg-white rounded-xl shadow-xl border-2 border-white/80 flex flex-col items-center justify-center transform rotate-12 group-hover:rotate-[16deg] transition-transform duration-300">
                    <div className="text-4xl font-black text-brand-cyan">7</div>
                    <div className="text-cyan-400 text-xs font-bold">★★★</div>
                </div>
            </div>
        </div>
    );
}

function TrioGameVisualMini() {
    return (
        <div className="relative flex items-center justify-center">
            <div className="absolute -left-6 w-12 h-16 bg-white rounded-lg shadow-lg flex items-center justify-center transform -rotate-12">
                <span className="text-brand-teal font-black text-lg">7</span>
            </div>
            <div className="relative w-12 h-16 bg-white rounded-lg shadow-lg flex items-center justify-center z-10">
                <span className="text-brand-blue font-black text-lg">7</span>
            </div>
            <div className="absolute -right-6 w-12 h-16 bg-white rounded-lg shadow-lg flex items-center justify-center transform rotate-12">
                <span className="text-brand-cyan font-black text-lg">7</span>
            </div>
        </div>
    );
}

function GameCardCompact({ game }: Readonly<{ game: Game }>) {
    const gradients: Record<string, string> = {
        'cheese-thief': 'from-amber-600 to-amber-800',
        'trio': 'from-blue-500 via-cyan-500 to-teal-500',
    };
    const gradient = gradients[game.slug] || 'from-amber-600 to-amber-800';

    return (
        <Link
            href={route('games.show', game.slug)}
            className="group relative bg-white rounded-2xl shadow-lg overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl"
        >
            <div className="flex">
                {/* Game Visual - Left */}
                <div className={`w-24 aspect-square bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 relative`}>
                    {game.slug === 'trio' ? (
                        <TrioGameVisualMini />
                    ) : game.slug === 'cheese-thief' ? (
                        <span className="text-4xl -rotate-[100deg]">{'\u{1F9C0}'}</span>
                    ) : (
                        <GameIcon name={getGameIcon(game.slug)} className="h-10 w-10 text-white" />
                    )}
                    {/* Active rooms badge */}
                    {game.active_rooms_count !== undefined && game.active_rooms_count > 0 && (
                        <div className="absolute top-1 right-1">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-500 text-white text-xs font-bold">
                                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                                {game.active_rooms_count}
                            </span>
                        </div>
                    )}
                </div>

                {/* Game Info - Right */}
                <div className="flex-1 p-3 flex flex-col justify-center min-w-0">
                    <h3 className="text-base font-black text-gray-900 truncate">
                        {game.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1">
                            <UsersIcon className="h-3 w-3" />
                            {game.min_players}-{game.max_players}
                        </span>
                        {game.estimated_duration_minutes && (
                            <span className="inline-flex items-center gap-1">
                                <ClockIcon className="h-3 w-3" />
                                ~{game.estimated_duration_minutes}m
                            </span>
                        )}
                    </div>
                    <div className="mt-2 text-xs font-bold text-purple-600 flex items-center gap-1">
                        Play <GameIcon name="rocket" size="xs" />
                    </div>
                </div>
            </div>
        </Link>
    );
}

function GameCard({ game }: Readonly<{ game: Game }>) {
    const gameIconName = getGameIcon(game.slug);
    const gradients: Record<string, string> = {
        'cheese-thief': 'from-amber-600 to-amber-800',
        'trio': 'from-blue-500 via-cyan-500 to-teal-500',
    };
    const gradient = gradients[game.slug] || 'from-amber-600 to-amber-800';

    return (
        <Link
            href={route('games.show', game.slug)}
            className="group relative bg-white rounded-2xl shadow-lg overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl"
        >
            {/* Game Image Area */}
            <div className={`aspect-[4/3] bg-gradient-to-br ${gradient} flex items-center justify-center relative overflow-hidden`}>
                {/* Animated background shapes */}
                <div className="absolute inset-0 opacity-30">
                    <div className="absolute top-3 left-3 w-12 h-12 bg-white/30 rounded-full animate-pulse" />
                    <div className="absolute bottom-6 right-6 w-16 h-16 bg-white/20 rounded-full" />
                </div>

                {/* Main game visual */}
                {game.slug === 'trio' ? (
                    <TrioGameVisual />
                ) : game.slug === 'cheese-thief' ? (
                    <span className="text-6xl group-hover:scale-125 transition-transform duration-500 drop-shadow-lg relative z-10 -rotate-[100deg]">{'\u{1F9C0}'}</span>
                ) : (
                    <div className="group-hover:scale-125 transition-transform duration-500 drop-shadow-lg relative z-10 text-white">
                        <GameIcon name={gameIconName} className="h-16 w-16" />
                    </div>
                )}

                {/* Play button overlay on hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
                    <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-50 group-hover:scale-100 shadow-lg">
                        <svg className="h-6 w-6 text-purple-600 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </div>
                </div>

                {/* Active rooms badge */}
                {game.active_rooms_count !== undefined && game.active_rooms_count > 0 && (
                    <div className="absolute top-3 right-3 z-20">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500 text-white text-xs font-bold shadow-lg animate-pulse">
                            <span className="w-1.5 h-1.5 bg-white rounded-full" />
                            {game.active_rooms_count} Live
                        </span>
                    </div>
                )}
            </div>

            {/* Game Info */}
            <div className="p-4">
                <h3 className="text-xl font-black text-gray-900 group-hover:text-purple-600 transition-colors">
                    {game.name}
                </h3>
                <p className="mt-1 text-gray-500 line-clamp-2 text-sm">
                    {game.description}
                </p>

                {/* Stats */}
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 text-xs font-bold">
                        <UsersIcon className="h-3.5 w-3.5" />
                        {game.min_players}-{game.max_players}
                    </span>
                    {game.estimated_duration_minutes && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-50 text-purple-600 text-xs font-bold">
                            <ClockIcon className="h-3.5 w-3.5" />
                            ~{game.estimated_duration_minutes}m
                        </span>
                    )}
                </div>

                {/* Play Button */}
                <div className="mt-4">
                    <div className="w-full rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 font-bold text-white text-center text-sm shadow-md group-hover:shadow-lg transition-all group-hover:from-blue-700 group-hover:to-purple-700 flex items-center justify-center gap-2">
                        Play Now <GameIcon name="rocket" size="sm" />
                    </div>
                </div>
            </div>
        </Link>
    );
}

function getGameIcon(slug: string): 'cheese' | 'card' | 'dice' {
    const icons: Record<string, 'cheese' | 'card' | 'dice'> = {
        'cheese-thief': 'cheese',
        'trio': 'card',
    };
    return icons[slug] || 'dice';
}

function UsersIcon({ className = 'h-4 w-4' }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
    );
}

function ClockIcon({ className = 'h-4 w-4' }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    );
}

function LinkIcon({ className = 'h-5 w-5' }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
    );
}
