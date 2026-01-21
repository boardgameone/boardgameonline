import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Game, PageProps } from '@/types';
import { Head, Link } from '@inertiajs/react';

interface Props extends PageProps {
    games: Game[];
}

export default function Index({ games }: Props) {
    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold leading-tight text-gray-800">
                        Games
                    </h2>
                    <Link
                        href={route('rooms.join')}
                        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
                    >
                        Join Room by Code
                    </Link>
                </div>
            }
        >
            <Head title="Games" />

            <div className="py-12">
                <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {games.map((game) => (
                            <GameCard key={game.id} game={game} />
                        ))}
                    </div>

                    {games.length === 0 && (
                        <div className="text-center py-12">
                            <p className="text-gray-500">
                                No games available at the moment.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

function GameCard({ game }: { game: Game }) {
    const gameEmoji = getGameEmoji(game.slug);

    return (
        <Link
            href={route('games.show', game.slug)}
            className="group relative overflow-hidden rounded-xl bg-white shadow-md transition hover:shadow-xl"
        >
            <div className="aspect-video bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center">
                <span className="text-6xl">{gameEmoji}</span>
            </div>
            <div className="p-5">
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600">
                    {game.name}
                </h3>
                <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                    {game.description}
                </p>
                <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                        <UsersIcon />
                        {game.min_players}-{game.max_players} players
                    </span>
                    {game.estimated_duration_minutes && (
                        <span className="flex items-center gap-1">
                            <ClockIcon />
                            ~{game.estimated_duration_minutes} min
                        </span>
                    )}
                </div>
                {game.active_rooms_count !== undefined && game.active_rooms_count > 0 && (
                    <div className="mt-3">
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                            {game.active_rooms_count} room{game.active_rooms_count !== 1 ? 's' : ''} waiting
                        </span>
                    </div>
                )}
            </div>
        </Link>
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
            className="h-4 w-4"
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
            className="h-4 w-4"
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
