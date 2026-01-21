import GameLayout from '@/Layouts/GameLayout';
import { Game, GameRoom, PageProps, User } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

interface WaitingRoom extends GameRoom {
    host?: User;
    connected_players_count?: number;
}

interface Props extends PageProps {
    game: Game;
    waitingRooms: WaitingRoom[];
}

export default function Show({ auth, game, waitingRooms }: Props) {
    const gameEmoji = getGameEmoji(game.slug);

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
        <GameLayout
            header={
                <div className="flex items-center gap-3">
                    <Link
                        href={route('games.index')}
                        className="text-gray-500 hover:text-gray-700"
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
                    </Link>
                    <h2 className="text-xl font-semibold leading-tight text-gray-800">
                        {game.name}
                    </h2>
                </div>
            }
        >
            <Head title={game.name} />

            <div className="py-12">
                <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
                    <div className="grid gap-8 lg:grid-cols-3">
                        <div className="lg:col-span-2 space-y-6">
                            <div className="overflow-hidden rounded-xl bg-white shadow">
                                <div className="aspect-video bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center">
                                    <span className="text-8xl">{gameEmoji}</span>
                                </div>
                                <div className="p-6">
                                    <h1 className="text-2xl font-bold text-gray-900">
                                        {game.name}
                                    </h1>
                                    <p className="mt-3 text-gray-600">
                                        {game.description}
                                    </p>
                                    <div className="mt-4 flex items-center gap-6 text-sm text-gray-500">
                                        <span className="flex items-center gap-2">
                                            <UsersIcon />
                                            {game.min_players}-{game.max_players} players
                                        </span>
                                        {game.estimated_duration_minutes && (
                                            <span className="flex items-center gap-2">
                                                <ClockIcon />
                                                ~{game.estimated_duration_minutes} minutes
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {game.rules && (
                                <div className="overflow-hidden rounded-xl bg-white p-6 shadow">
                                    <h2 className="text-lg font-bold text-gray-900">
                                        How to Play
                                    </h2>
                                    <div className="mt-4 space-y-4 text-sm text-gray-600">
                                        {Object.entries(game.rules).map(([key, value]) => (
                                            <div key={key}>
                                                <h3 className="font-semibold text-gray-800 capitalize">
                                                    {key.replace(/_/g, ' ')}
                                                </h3>
                                                {typeof value === 'string' ? (
                                                    <p className="mt-1">{value}</p>
                                                ) : (
                                                    <ul className="mt-1 list-disc list-inside space-y-1">
                                                        {Object.entries(value as Record<string, string>).map(
                                                            ([subKey, subValue]) => (
                                                                <li key={subKey}>
                                                                    <strong>{subKey}:</strong> {subValue}
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

                        <div className="space-y-6">
                            <div className="overflow-hidden rounded-xl bg-white p-6 shadow">
                                <h2 className="text-lg font-bold text-gray-900">
                                    Create a Room
                                </h2>
                                <form onSubmit={submit} className="mt-4 space-y-4">
                                    {!auth.user && (
                                        <div>
                                            <label
                                                htmlFor="nickname"
                                                className="block text-sm font-medium text-gray-700"
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
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
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
                                            className="block text-sm font-medium text-gray-700"
                                        >
                                            Room Name (optional)
                                        </label>
                                        <input
                                            id="name"
                                            type="text"
                                            value={data.name}
                                            onChange={(e) => setData('name', e.target.value)}
                                            placeholder="My Game Room"
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
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
                                        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
                                    >
                                        {processing ? 'Creating...' : 'Create Room'}
                                    </button>
                                </form>
                            </div>

                            {waitingRooms.length > 0 && (
                                <div className="overflow-hidden rounded-xl bg-white p-6 shadow">
                                    <h2 className="text-lg font-bold text-gray-900">
                                        Open Rooms
                                    </h2>
                                    <ul className="mt-4 space-y-3">
                                        {waitingRooms.map((room) => (
                                            <li key={room.id}>
                                                <Link
                                                    href={route('rooms.show', room.room_code)}
                                                    className="block rounded-lg border border-gray-200 p-4 transition hover:border-blue-500 hover:bg-blue-50"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="font-medium text-gray-900">
                                                                {room.name || `Room ${room.room_code}`}
                                                            </p>
                                                            <p className="text-sm text-gray-500">
                                                                Hosted by {room.host?.name || 'Unknown'}
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-sm font-medium text-gray-900">
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
                            )}

                            <div className="overflow-hidden rounded-xl bg-gray-50 p-6 shadow">
                                <h2 className="text-lg font-bold text-gray-900">
                                    Have a Room Code?
                                </h2>
                                <p className="mt-2 text-sm text-gray-600">
                                    Join a friend's room directly using their room code.
                                </p>
                                <Link
                                    href={route('rooms.join')}
                                    className="mt-4 block w-full rounded-md bg-gray-200 px-4 py-2 text-center text-sm font-semibold text-gray-700 hover:bg-gray-300"
                                >
                                    Join with Code
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </GameLayout>
    );
}

function getGameEmoji(slug: string): string {
    const emojis: Record<string, string> = {
        'cheese-thief': '\u{1F9C0}',
    };
    return emojis[slug] || '\u{1F3B2}';
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
