import GameLayout from '@/Layouts/GameLayout';
import { Game, GameRoom, PageProps, User } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';
import GameIcon from '@/Components/GameIcon';

interface WaitingRoom extends GameRoom {
    host?: User;
    connected_players_count?: number;
}

interface Props extends PageProps {
    game: Game;
    waitingRooms: WaitingRoom[];
}

export default function Show({ auth, game, waitingRooms }: Props) {
    const gradients: Record<string, string> = {
        'cheese-thief': 'from-amber-600 to-amber-800',
        'trio': 'from-blue-500 via-cyan-500 to-teal-500',
    };
    const borderColors: Record<string, string> = {
        'cheese-thief': 'border-amber-800',
        'trio': 'border-teal-500',
    };
    const gradient = gradients[game.slug] || 'from-amber-600 to-amber-800';
    const borderColor = borderColors[game.slug] || 'border-amber-800';

    const { data, setData, post, processing, errors } = useForm({
        game_id: game.id,
        name: '',
        nickname: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('rooms.store'));
    };

    return (
        <GameLayout>
            <Head title={game.name} />

            {/* Back button */}
            <div className="mb-6">
                <Link
                    href={route('games.index')}
                    className="inline-flex items-center gap-2 text-yellow-900 hover:text-yellow-700 font-bold transition"
                >
                    <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 19l-7-7 7-7"
                        />
                    </svg>
                    Back to Games
                </Link>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
                {/* Main content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Game Hero */}
                    <div className={`group bg-white rounded-3xl shadow-xl overflow-hidden border-b-8 ${borderColor}`}>
                        <div className={`aspect-video bg-gradient-to-br ${gradient} flex items-center justify-center relative`}>
                            {game.slug === 'trio' ? (
                                <TrioGameVisual />
                            ) : game.slug === 'cheese-thief' ? (
                                <span className="text-9xl -rotate-[100deg]">{'\u{1F9C0}'}</span>
                            ) : (
                                <div className="text-white">
                                    <GameIcon name={getGameIcon(game.slug)} className="h-32 w-32" />
                                </div>
                            )}
                            {/* Decorative elements */}
                            <div className="absolute top-4 left-4 opacity-20 rotate-12 text-white">
                                <GameIcon name="star" size="lg" />
                            </div>
                            <div className="absolute top-4 right-4 opacity-20 -rotate-12 text-white">
                                <GameIcon name="dice" size="lg" />
                            </div>
                            <div className="absolute bottom-4 left-4 opacity-20 -rotate-12 text-white">
                                <GameIcon name="dice" size="lg" />
                            </div>
                            <div className="absolute bottom-4 right-4 opacity-20 rotate-12 text-white">
                                <GameIcon name="star" size="lg" />
                            </div>
                        </div>
                        <div className="p-6 sm:p-8">
                            <h1 className="text-3xl font-black text-gray-900">
                                {game.name}
                            </h1>
                            <p className="mt-3 text-gray-600 text-lg">
                                {game.description}
                            </p>
                            <div className="mt-6 flex flex-wrap items-center gap-4">
                                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 text-blue-700 font-bold">
                                    <UsersIcon />
                                    {game.min_players}-{game.max_players} players
                                </span>
                                {game.estimated_duration_minutes && (
                                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-100 text-purple-700 font-bold">
                                        <ClockIcon />
                                        ~{game.estimated_duration_minutes} minutes
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Rules */}
                    {game.rules && (
                        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
                            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                                <GameIcon name="book" /> How to Play
                            </h2>
                            <div className="mt-6 space-y-6">
                                {Object.entries(game.rules).map(([key, value]) => (
                                    <div key={key} className="bg-yellow-50 rounded-xl p-4">
                                        <h3 className="font-bold text-yellow-800 capitalize text-lg">
                                            {key.replace(/_/g, ' ')}
                                        </h3>
                                        {typeof value === 'string' ? (
                                            <p className="mt-2 text-gray-700">{value}</p>
                                        ) : (
                                            <ul className="mt-2 space-y-2">
                                                {Object.entries(value as Record<string, string>).map(
                                                    ([subKey, subValue]) => (
                                                        <li key={subKey} className="flex gap-2 text-gray-700">
                                                            <span className="font-bold text-yellow-700">{subKey}:</span>
                                                            <span>{subValue}</span>
                                                        </li>
                                                    )
                                                )}
                                            </ul>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Create Room */}
                    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <GameIcon name="gamepad" /> Create a Room
                            </h2>
                        </div>
                        <div className="p-6">
                            <form onSubmit={submit} className="space-y-4">
                                {!auth.user && (
                                    <div>
                                        <label
                                            htmlFor="nickname"
                                            className="block text-sm font-bold text-gray-700 mb-1"
                                        >
                                            Your Nickname
                                        </label>
                                        <input
                                            id="nickname"
                                            type="text"
                                            value={data.nickname}
                                            onChange={(e) => setData('nickname', e.target.value)}
                                            placeholder="Enter your nickname"
                                            maxLength={20}
                                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-yellow-400 focus:ring-yellow-400 transition-colors font-medium"
                                            required
                                        />
                                        {errors.nickname && (
                                            <p className="mt-1 text-sm text-red-600">
                                                {errors.nickname}
                                            </p>
                                        )}
                                    </div>
                                )}
                                <div>
                                    <label
                                        htmlFor="name"
                                        className="block text-sm font-bold text-gray-700 mb-1"
                                    >
                                        Room Name (optional)
                                    </label>
                                    <input
                                        id="name"
                                        type="text"
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        placeholder="My Awesome Game Room"
                                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-yellow-400 focus:ring-yellow-400 transition-colors font-medium"
                                    />
                                    {errors.name && (
                                        <p className="mt-1 text-sm text-red-600">
                                            {errors.name}
                                        </p>
                                    )}
                                </div>
                                <button
                                    type="submit"
                                    disabled={processing || (!auth.user && !data.nickname)}
                                    className="w-full rounded-full bg-blue-600 px-6 py-3 font-bold text-white shadow-lg transition hover:scale-105 hover:bg-blue-700 border-b-4 border-blue-800 disabled:opacity-50 disabled:hover:scale-100"
                                >
                                    {processing ? 'Creating...' : 'Create Room'}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Open Rooms */}
                    {waitingRooms.length > 0 && (
                        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                            <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4">
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <GameIcon name="circle" size="sm" className="text-green-300" /> Open Rooms
                                </h2>
                            </div>
                            <div className="p-4">
                                <ul className="space-y-3">
                                    {waitingRooms.map((room) => (
                                        <li key={room.id}>
                                            <Link
                                                href={route('rooms.show', [game.slug, room.room_code])}
                                                className="block rounded-xl border-2 border-gray-100 p-4 transition hover:border-green-400 hover:bg-green-50"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-bold text-gray-900">
                                                            {room.name || `Room ${room.room_code}`}
                                                        </p>
                                                        <p className="text-sm text-gray-500">
                                                            Hosted by {room.host?.name || 'Unknown'}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-lg font-black text-green-600">
                                                            {room.connected_players_count || 0}/{game.max_players}
                                                        </p>
                                                        <p className="text-xs text-gray-500">players</p>
                                                    </div>
                                                </div>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* Join with Code */}
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <GameIcon name="link" /> Have a Room Code?
                        </h2>
                        <p className="mt-2 text-sm text-gray-600">
                            Join a friend's room directly using their room code.
                        </p>
                        <Link
                            href={route('rooms.join')}
                            className="mt-4 block w-full rounded-full bg-white px-6 py-3 text-center font-bold text-yellow-600 shadow-md hover:scale-105 transition border-b-4 border-yellow-400"
                        >
                            Join with Code
                        </Link>
                    </div>
                </div>
            </div>
        </GameLayout>
    );
}

function TrioGameVisual() {
    return (
        <div className="relative">
            {/* Three overlapping cards showing a trio */}
            <div className="relative flex items-center justify-center">
                {/* Card 1 - Left */}
                <div className="absolute -left-16 w-32 h-44 bg-white rounded-2xl shadow-2xl border-4 border-white/90 flex flex-col items-center justify-center transform -rotate-12">
                    <div className="text-6xl font-black text-purple-600">7</div>
                    <div className="mt-2 text-purple-400 text-sm font-bold">★★★</div>
                </div>

                {/* Card 2 - Center */}
                <div className="relative w-32 h-44 bg-white rounded-2xl shadow-2xl border-4 border-white/90 flex flex-col items-center justify-center z-10">
                    <div className="text-6xl font-black text-indigo-600">7</div>
                    <div className="mt-2 text-indigo-400 text-sm font-bold">★★★</div>
                </div>

                {/* Card 3 - Right */}
                <div className="absolute -right-16 w-32 h-44 bg-white rounded-2xl shadow-2xl border-4 border-white/90 flex flex-col items-center justify-center transform rotate-12">
                    <div className="text-6xl font-black text-pink-600">7</div>
                    <div className="mt-2 text-pink-400 text-sm font-bold">★★★</div>
                </div>
            </div>
        </div>
    );
}

function getGameIcon(slug: string): 'cheese' | 'card' | 'dice' {
    const icons: Record<string, 'cheese' | 'card' | 'dice'> = {
        'cheese-thief': 'cheese',
        'trio': 'card',
    };
    return icons[slug] || 'dice';
}

function UsersIcon() {
    return (
        <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
        </svg>
    );
}

function ClockIcon() {
    return (
        <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
        </svg>
    );
}
