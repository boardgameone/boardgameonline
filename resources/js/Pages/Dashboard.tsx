import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Game, GameRoom, PageProps } from '@/types';
import { Head, Link } from '@inertiajs/react';
import GameIcon from '@/Components/GameIcon';

interface Props extends PageProps {
    recentGames?: Game[];
    activeRooms?: GameRoom[];
    stats?: {
        gamesPlayed: number;
        wins: number;
        totalPlayTime: number;
    };
}

export default function Dashboard({ auth, recentGames = [], activeRooms = [], stats }: Props) {
    return (
        <AuthenticatedLayout>
            <Head title="Dashboard" />

            {/* Welcome Section */}
            <div className="mb-8">
                <div className="bg-white rounded-3xl shadow-xl overflow-hidden border-b-8 border-yellow-500">
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8 sm:px-8">
                        <div className="flex flex-col sm:flex-row items-center gap-6">
                            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm shadow-lg text-white">
                                <GameIcon name="gamepad" size="xl" />
                            </div>
                            <div className="text-center sm:text-left">
                                <h1 className="text-2xl sm:text-3xl font-black text-white">
                                    Welcome back, {auth.user?.name}!
                                </h1>
                                <p className="text-blue-100 mt-1 text-lg">
                                    Ready for some fun? Let's play!
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-3 divide-x divide-gray-100">
                        <div className="px-4 py-5 text-center">
                            <div className="text-3xl font-black text-yellow-500">
                                {stats?.gamesPlayed ?? 0}
                            </div>
                            <div className="text-sm text-gray-500 font-medium">Games Played</div>
                        </div>
                        <div className="px-4 py-5 text-center">
                            <div className="text-3xl font-black text-green-500">
                                {stats?.wins ?? 0}
                            </div>
                            <div className="text-sm text-gray-500 font-medium">Victories</div>
                        </div>
                        <div className="px-4 py-5 text-center">
                            <div className="text-3xl font-black text-blue-500">
                                {stats?.totalPlayTime ?? 0}h
                            </div>
                            <div className="text-sm text-gray-500 font-medium">Play Time</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
                <Link
                    href={route('games.index')}
                    className="group bg-white rounded-2xl shadow-lg p-6 transition hover:scale-105 hover:shadow-xl border-b-4 border-yellow-400"
                >
                    <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-500 shadow-md group-hover:scale-110 transition text-white">
                            <GameIcon name="dice" size="lg" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 text-lg">Browse Games</h3>
                            <p className="text-gray-500 text-sm">Find your next adventure</p>
                        </div>
                    </div>
                </Link>

                <Link
                    href={route('rooms.join')}
                    className="group bg-white rounded-2xl shadow-lg p-6 transition hover:scale-105 hover:shadow-xl border-b-4 border-blue-400"
                >
                    <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-md group-hover:scale-110 transition text-white">
                            <GameIcon name="link" size="lg" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 text-lg">Join Room</h3>
                            <p className="text-gray-500 text-sm">Enter a room code</p>
                        </div>
                    </div>
                </Link>

                <Link
                    href={route('profile.edit')}
                    className="group bg-white rounded-2xl shadow-lg p-6 transition hover:scale-105 hover:shadow-xl border-b-4 border-purple-400 sm:col-span-2 lg:col-span-1"
                >
                    <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-md group-hover:scale-110 transition text-white">
                            <GameIcon name="user" size="lg" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 text-lg">Your Profile</h3>
                            <p className="text-gray-500 text-sm">Customize your account</p>
                        </div>
                    </div>
                </Link>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Active Rooms */}
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-green-500 to-green-600">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <GameIcon name="gamepad" /> Your Active Rooms
                        </h2>
                    </div>
                    <div className="p-6">
                        {activeRooms.length > 0 ? (
                            <div className="space-y-3">
                                {activeRooms.map((room) => (
                                    <Link
                                        key={room.id}
                                        href={route('rooms.show', room.room_code)}
                                        className="flex items-center justify-between p-4 rounded-xl bg-gray-50 hover:bg-yellow-50 transition border-2 border-transparent hover:border-yellow-300"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="text-2xl text-amber-600">
                                                {room.game?.slug === 'cheese-thief' ? (
                                                    <span className="text-3xl">{'\u{1F9C0}'}</span>
                                                ) : (
                                                    <GameIcon name={getGameIcon(room.game?.slug)} size="lg" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900">
                                                    {room.name || room.game?.name}
                                                </p>
                                                <p className="text-sm text-gray-500">
                                                    Code: {room.room_code}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                            room.status === 'waiting'
                                                ? 'bg-yellow-100 text-yellow-700'
                                                : room.status === 'playing'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 text-gray-700'
                                        }`}>
                                            {room.status}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <div className="mb-3 opacity-50 flex justify-center text-gray-400">
                                    <GameIcon name="gamepad" size="xl" />
                                </div>
                                <p className="text-gray-500 font-medium">No active rooms</p>
                                <Link
                                    href={route('games.index')}
                                    className="inline-block mt-4 rounded-full bg-green-500 px-6 py-2 font-bold text-white shadow-md hover:bg-green-600 transition hover:scale-105 border-b-4 border-green-700"
                                >
                                    Start Playing
                                </Link>
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Games */}
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-purple-500 to-purple-600">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <GameIcon name="trophy" /> Featured Games
                        </h2>
                    </div>
                    <div className="p-6">
                        {recentGames.length > 0 ? (
                            <div className="grid gap-3">
                                {recentGames.slice(0, 4).map((game) => (
                                    <Link
                                        key={game.id}
                                        href={route('games.show', game.slug)}
                                        className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 hover:bg-purple-50 transition border-2 border-transparent hover:border-purple-300"
                                    >
                                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-500 shadow-sm text-white">
                                            {game.slug === 'cheese-thief' ? (
                                                <span className="text-2xl">{'\u{1F9C0}'}</span>
                                            ) : (
                                                <GameIcon name={getGameIcon(game.slug)} size="lg" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-gray-900 truncate">
                                                {game.name}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                {game.min_players}-{game.max_players} players
                                            </p>
                                        </div>
                                        <svg
                                            className="h-5 w-5 text-gray-400"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M9 5l7 7-7 7"
                                            />
                                        </svg>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <div className="mb-3 opacity-50 flex justify-center text-gray-400">
                                    <GameIcon name="dice" size="xl" />
                                </div>
                                <p className="text-gray-500 font-medium">Discover new games</p>
                                <Link
                                    href={route('games.index')}
                                    className="inline-block mt-4 rounded-full bg-purple-500 px-6 py-2 font-bold text-white shadow-md hover:bg-purple-600 transition hover:scale-105 border-b-4 border-purple-700"
                                >
                                    Browse Games
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

function getGameIcon(slug?: string): 'cheese' | 'card' | 'dice' {
    if (!slug) return 'dice';
    const icons: Record<string, 'cheese' | 'card' | 'dice'> = {
        'cheese-thief': 'cheese',
        'trio': 'card',
    };
    return icons[slug] || 'dice';
}
