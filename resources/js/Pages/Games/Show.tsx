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
        <GameLayout fullHeight>
            <Head title={game.name} />

            {/* Mobile Layout - vertical stacking with scroll */}
            <div className="h-full flex flex-col gap-3 p-2 lg:hidden overflow-auto">
                {/* Back button - compact */}
                <Link
                    href={route('games.index')}
                    className="inline-flex items-center gap-1.5 text-yellow-900 hover:text-yellow-700 font-bold transition text-sm"
                >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                </Link>

                {/* Game Hero - compact card */}
                <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 p-3 shadow-lg border border-blue-200">
                    <div className="flex items-center gap-3">
                        <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
                            {game.slug === 'trio' ? (
                                <TrioGameVisualMini />
                            ) : game.slug === 'cheese-thief' ? (
                                <span className="text-3xl -rotate-[100deg]">{'\u{1F9C0}'}</span>
                            ) : (
                                <div className="text-white">
                                    <GameIcon name={getGameIcon(game.slug)} className="h-8 w-8" />
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-xl font-black text-gray-900 truncate">{game.name}</h1>
                            <div className="flex items-center gap-2 mt-1 text-sm">
                                <span className="inline-flex items-center gap-1 text-blue-700 font-semibold">
                                    <UsersIcon className="h-4 w-4" />
                                    {game.min_players}-{game.max_players}
                                </span>
                                {game.estimated_duration_minutes && (
                                    <span className="inline-flex items-center gap-1 text-purple-700 font-semibold">
                                        <ClockIcon className="h-4 w-4" />
                                        ~{game.estimated_duration_minutes}m
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <p className="mt-2 text-gray-600 text-sm line-clamp-2">{game.description}</p>
                </div>

                {/* Create Room */}
                <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-100 p-4 shadow-lg border border-teal-200">
                    <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-3">
                        <GameIcon name="gamepad" size="sm" /> Create a Room
                    </h2>
                    <form onSubmit={submit} className="space-y-3">
                        {!auth.user && (
                            <div>
                                <label htmlFor="nickname-mobile" className="block text-xs font-bold text-gray-700 mb-1">
                                    Your Nickname
                                </label>
                                <input
                                    id="nickname-mobile"
                                    type="text"
                                    value={data.nickname}
                                    onChange={(e) => setData('nickname', e.target.value)}
                                    placeholder="Enter your nickname"
                                    maxLength={20}
                                    className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-teal-400 focus:ring-teal-400 transition-colors font-medium text-sm"
                                    required
                                />
                                {errors.nickname && <p className="mt-1 text-xs text-red-600">{errors.nickname}</p>}
                            </div>
                        )}
                        <div>
                            <label htmlFor="name-mobile" className="block text-xs font-bold text-gray-700 mb-1">
                                Room Name (optional)
                            </label>
                            <input
                                id="name-mobile"
                                type="text"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                placeholder="My Awesome Game Room"
                                className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-teal-400 focus:ring-teal-400 transition-colors font-medium text-sm"
                            />
                            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
                        </div>
                        <button
                            type="submit"
                            disabled={processing || (!auth.user && !data.nickname)}
                            className="w-full rounded-full bg-teal-600 px-4 py-2.5 font-bold text-white shadow-lg transition hover:scale-105 hover:bg-teal-700 border-b-4 border-teal-800 disabled:opacity-50 disabled:hover:scale-100 text-sm"
                        >
                            {processing ? 'Creating...' : 'Create Room'}
                        </button>
                    </form>
                </div>

                {/* Open Rooms */}
                {waitingRooms.length > 0 && (
                    <div className="rounded-xl bg-gradient-to-br from-green-50 to-emerald-100 p-4 shadow-lg border border-green-200">
                        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-3">
                            <GameIcon name="circle" size="sm" className="text-green-600" /> Open Rooms
                        </h2>
                        <ul className="space-y-2">
                            {waitingRooms.map((room) => (
                                <li key={room.id}>
                                    <Link
                                        href={route('rooms.show', [game.slug, room.room_code])}
                                        className="block rounded-lg border-2 border-green-200 bg-white/50 p-3 transition hover:border-green-400 hover:bg-green-50"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-gray-900 text-sm">
                                                    {room.name || `Room ${room.room_code}`}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    Hosted by {room.host?.name || 'Unknown'}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-black text-green-600">
                                                    {room.connected_players_count || 0}/{game.max_players}
                                                </p>
                                            </div>
                                        </div>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Rules - scrollable */}
                {game.rules && (
                    <div className="rounded-xl bg-gradient-to-br from-amber-50 to-yellow-100 p-4 shadow-lg border border-yellow-200">
                        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-3">
                            <GameIcon name="book" size="sm" /> How to Play
                        </h2>
                        <div className="space-y-3">
                            {Object.entries(game.rules).map(([key, value]) => (
                                <div key={key} className="bg-white/60 rounded-lg p-3">
                                    <h3 className="font-bold text-yellow-800 capitalize text-sm">
                                        {key.replace(/_/g, ' ')}
                                    </h3>
                                    {typeof value === 'string' ? (
                                        <p className="mt-1 text-gray-700 text-sm">{value}</p>
                                    ) : (
                                        <ul className="mt-1 space-y-1">
                                            {Object.entries(value as Record<string, string>).map(
                                                ([subKey, subValue]) => (
                                                    <li key={subKey} className="flex gap-1 text-gray-700 text-sm">
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

                {/* Join with Code */}
                <div className="rounded-xl bg-gradient-to-br from-purple-50 to-violet-100 p-4 shadow-lg border border-purple-200">
                    <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                        <GameIcon name="link" size="sm" /> Have a Room Code?
                    </h2>
                    <p className="mt-1 text-xs text-gray-600">
                        Join a friend's room directly using their room code.
                    </p>
                    <Link
                        href={route('rooms.join')}
                        className="mt-3 block w-full rounded-full bg-white px-4 py-2 text-center font-bold text-purple-600 shadow-md hover:scale-105 transition border-b-4 border-purple-300 text-sm"
                    >
                        Join with Code
                    </Link>
                </div>
            </div>

            {/* Desktop Layout - 2-column grid, fit viewport */}
            <div className="hidden lg:grid lg:grid-cols-12 gap-4 h-full p-4">
                {/* Left Column - Game Info & Rules */}
                <div className="col-span-8 flex flex-col gap-4 min-h-0">
                    {/* Back button - inline */}
                    <Link
                        href={route('games.index')}
                        className="inline-flex items-center gap-2 text-yellow-900 hover:text-yellow-700 font-bold transition w-fit"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Games
                    </Link>

                    {/* Game Hero - compact */}
                    <div className={`rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 shadow-lg border border-blue-200 overflow-hidden`}>
                        <div className="flex">
                            <div className={`w-48 aspect-square bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 relative`}>
                                {game.slug === 'trio' ? (
                                    <TrioGameVisual />
                                ) : game.slug === 'cheese-thief' ? (
                                    <span className="text-7xl -rotate-[100deg]">{'\u{1F9C0}'}</span>
                                ) : (
                                    <div className="text-white">
                                        <GameIcon name={getGameIcon(game.slug)} className="h-20 w-20" />
                                    </div>
                                )}
                                {/* Decorative elements */}
                                <div className="absolute top-2 left-2 opacity-20 text-white">
                                    <GameIcon name="star" size="sm" />
                                </div>
                                <div className="absolute bottom-2 right-2 opacity-20 text-white">
                                    <GameIcon name="dice" size="sm" />
                                </div>
                            </div>
                            <div className="flex-1 p-5 flex flex-col justify-center">
                                <h1 className="text-2xl font-black text-gray-900">{game.name}</h1>
                                <p className="mt-2 text-gray-600">{game.description}</p>
                                <div className="mt-3 flex items-center gap-3">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                                        <UsersIcon className="h-4 w-4" />
                                        {game.min_players}-{game.max_players} players
                                    </span>
                                    {game.estimated_duration_minutes && (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 font-bold text-sm">
                                            <ClockIcon className="h-4 w-4" />
                                            ~{game.estimated_duration_minutes} min
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Rules - scrollable within container */}
                    {game.rules && (
                        <div className="flex-1 rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-100 shadow-lg border border-yellow-200 flex flex-col min-h-0 overflow-hidden">
                            <div className="p-4 border-b border-yellow-200/50">
                                <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                                    <GameIcon name="book" /> How to Play
                                </h2>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4">
                                <div className="space-y-4">
                                    {Object.entries(game.rules).map(([key, value]) => (
                                        <div key={key} className="bg-white/60 rounded-xl p-4">
                                            <h3 className="font-bold text-yellow-800 capitalize">
                                                {key.replace(/_/g, ' ')}
                                            </h3>
                                            {typeof value === 'string' ? (
                                                <p className="mt-2 text-gray-700">{value}</p>
                                            ) : (
                                                <ul className="mt-2 space-y-1.5">
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
                        </div>
                    )}
                </div>

                {/* Right Column - Actions */}
                <div className="col-span-4 flex flex-col gap-4 min-h-0">
                    {/* Create Room */}
                    <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-100 shadow-lg border border-teal-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-4 py-3">
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                <GameIcon name="gamepad" size="sm" /> Create a Room
                            </h2>
                        </div>
                        <div className="p-4">
                            <form onSubmit={submit} className="space-y-3">
                                {!auth.user && (
                                    <div>
                                        <label htmlFor="nickname" className="block text-xs font-bold text-gray-700 mb-1">
                                            Your Nickname
                                        </label>
                                        <input
                                            id="nickname"
                                            type="text"
                                            value={data.nickname}
                                            onChange={(e) => setData('nickname', e.target.value)}
                                            placeholder="Enter your nickname"
                                            maxLength={20}
                                            className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 focus:border-teal-400 focus:ring-teal-400 transition-colors font-medium"
                                            required
                                        />
                                        {errors.nickname && <p className="mt-1 text-sm text-red-600">{errors.nickname}</p>}
                                    </div>
                                )}
                                <div>
                                    <label htmlFor="name" className="block text-xs font-bold text-gray-700 mb-1">
                                        Room Name (optional)
                                    </label>
                                    <input
                                        id="name"
                                        type="text"
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        placeholder="My Awesome Game Room"
                                        className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 focus:border-teal-400 focus:ring-teal-400 transition-colors font-medium"
                                    />
                                    {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
                                </div>
                                <button
                                    type="submit"
                                    disabled={processing || (!auth.user && !data.nickname)}
                                    className="w-full rounded-full bg-teal-600 px-4 py-2.5 font-bold text-white shadow-lg transition hover:scale-105 hover:bg-teal-700 border-b-4 border-teal-800 disabled:opacity-50 disabled:hover:scale-100"
                                >
                                    {processing ? 'Creating...' : 'Create Room'}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Open Rooms */}
                    {waitingRooms.length > 0 && (
                        <div className="rounded-2xl bg-gradient-to-br from-green-50 to-emerald-100 shadow-lg border border-green-200 overflow-hidden flex-1 min-h-0 flex flex-col">
                            <div className="bg-gradient-to-r from-green-500 to-green-600 px-4 py-3">
                                <h2 className="text-base font-bold text-white flex items-center gap-2">
                                    <GameIcon name="circle" size="sm" className="text-green-300" /> Open Rooms
                                </h2>
                            </div>
                            <div className="p-3 overflow-y-auto flex-1">
                                <ul className="space-y-2">
                                    {waitingRooms.map((room) => (
                                        <li key={room.id}>
                                            <Link
                                                href={route('rooms.show', [game.slug, room.room_code])}
                                                className="block rounded-xl border-2 border-green-200 bg-white/50 p-3 transition hover:border-green-400 hover:bg-green-50"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-bold text-gray-900 text-sm">
                                                            {room.name || `Room ${room.room_code}`}
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            Hosted by {room.host?.name || 'Unknown'}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-lg font-black text-green-600">
                                                            {room.connected_players_count || 0}/{game.max_players}
                                                        </p>
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
                    <div className="rounded-2xl bg-gradient-to-br from-purple-50 to-violet-100 shadow-lg border border-purple-200 p-4">
                        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <GameIcon name="link" size="sm" /> Have a Room Code?
                        </h2>
                        <p className="mt-1 text-sm text-gray-600">
                            Join a friend's room directly using their room code.
                        </p>
                        <Link
                            href={route('rooms.join')}
                            className="mt-3 block w-full rounded-full bg-white px-4 py-2.5 text-center font-bold text-purple-600 shadow-md hover:scale-105 transition border-b-4 border-purple-300"
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
        <div className="relative scale-75">
            {/* Three overlapping cards showing a trio */}
            <div className="relative flex items-center justify-center">
                {/* Card 1 - Left */}
                <div className="absolute -left-12 w-24 h-32 bg-white rounded-xl shadow-xl border-2 border-white/90 flex flex-col items-center justify-center transform -rotate-12">
                    <div className="text-4xl font-black text-purple-600">7</div>
                    <div className="text-purple-400 text-xs font-bold">★★★</div>
                </div>

                {/* Card 2 - Center */}
                <div className="relative w-24 h-32 bg-white rounded-xl shadow-xl border-2 border-white/90 flex flex-col items-center justify-center z-10">
                    <div className="text-4xl font-black text-indigo-600">7</div>
                    <div className="text-indigo-400 text-xs font-bold">★★★</div>
                </div>

                {/* Card 3 - Right */}
                <div className="absolute -right-12 w-24 h-32 bg-white rounded-xl shadow-xl border-2 border-white/90 flex flex-col items-center justify-center transform rotate-12">
                    <div className="text-4xl font-black text-pink-600">7</div>
                    <div className="text-pink-400 text-xs font-bold">★★★</div>
                </div>
            </div>
        </div>
    );
}

function TrioGameVisualMini() {
    return (
        <div className="relative flex items-center justify-center scale-50">
            <div className="absolute -left-4 w-8 h-10 bg-white rounded shadow-lg flex items-center justify-center transform -rotate-12">
                <span className="text-purple-600 font-black text-sm">7</span>
            </div>
            <div className="relative w-8 h-10 bg-white rounded shadow-lg flex items-center justify-center z-10">
                <span className="text-indigo-600 font-black text-sm">7</span>
            </div>
            <div className="absolute -right-4 w-8 h-10 bg-white rounded shadow-lg flex items-center justify-center transform rotate-12">
                <span className="text-pink-600 font-black text-sm">7</span>
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

function UsersIcon({ className = 'h-5 w-5' }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
        </svg>
    );
}

function ClockIcon({ className = 'h-5 w-5' }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
        </svg>
    );
}
