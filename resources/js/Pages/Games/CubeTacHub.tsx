import GameIcon from '@/Components/GameIcon';
import GameLayout from '@/Layouts/GameLayout';
import CubeTacLogo from '@/Pages/Rooms/CubeTac/components/CubeTacLogo';
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

export default function CubeTacHub({ auth, game, waitingRooms }: Props) {
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
            <Head title={`${game.name} - Tic-tac-toe on a Rubik's cube`} />

            {/* Mobile Layout */}
            <div className="h-full flex flex-col gap-3 p-2 lg:hidden overflow-auto">
                <Link
                    href={route('games.index')}
                    className="inline-flex items-center gap-1.5 text-yellow-900 hover:text-yellow-700 font-bold transition text-sm"
                >
                    <BackArrow className="h-4 w-4" />
                    Back
                </Link>

                {/* Hero card — mobile */}
                <div className="relative rounded-3xl bg-gradient-to-br from-rose-100 via-amber-50 to-sky-100 p-5 shadow-xl border-2 border-white/60 overflow-hidden">
                    <FloatingMarks variant="mobile" />
                    <div className="relative z-10 flex flex-col items-center gap-4">
                        <CubeTacLogo size="md" layout="stacked" showTagline />
                        <p className="text-center text-gray-700 text-sm font-medium line-clamp-3 max-w-xs">
                            {game.description}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap justify-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/80 text-indigo-700 font-bold text-xs">
                                <UsersIcon className="h-3.5 w-3.5" />
                                {game.min_players}-{game.max_players}
                            </span>
                            {game.estimated_duration_minutes && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/80 text-purple-700 font-bold text-xs">
                                    <ClockIcon className="h-3.5 w-3.5" />
                                    ~{game.estimated_duration_minutes}m
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Play Local — big primary action, always visible */}
                <Link
                    href={route('cubetac.local')}
                    className="block rounded-xl bg-gradient-to-r from-orange-500 via-rose-500 to-pink-600 px-4 py-3 text-center font-bold text-white shadow-lg border-b-4 border-rose-700 hover:scale-[1.02] transition"
                >
                    <span className="inline-flex items-center gap-2 text-sm">
                        <LocalIcon className="h-5 w-5" />
                        Play Locally (Pass &amp; Play)
                    </span>
                </Link>

                {/* Create Online Room */}
                <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-100 p-4 shadow-lg border border-teal-200">
                    <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-3">
                        <GameIcon name="gamepad" size="sm" /> Online Match
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

                {/* Rules */}
                {game.rules && (
                    <div className="rounded-xl bg-gradient-to-br from-amber-50 to-yellow-100 p-4 shadow-lg border border-yellow-200">
                        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-3">
                            <GameIcon name="book" size="sm" /> How to Play
                        </h2>
                        <div className="space-y-3">
                            {Object.entries(game.rules).map(([key, value]) => (
                                <RuleItem key={key} label={key} value={value} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Join with code */}
                <div className="rounded-xl bg-gradient-to-br from-purple-50 to-violet-100 p-4 shadow-lg border border-purple-200">
                    <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                        <GameIcon name="link" size="sm" /> Have a Room Code?
                    </h2>
                    <p className="mt-1 text-xs text-gray-600">Join a friend&apos;s room directly.</p>
                    <Link
                        href={route('rooms.join')}
                        className="mt-3 block w-full rounded-full bg-white px-4 py-2 text-center font-bold text-purple-600 shadow-md hover:scale-105 transition border-b-4 border-purple-300 text-sm"
                    >
                        Join with Code
                    </Link>
                </div>
            </div>

            {/* Desktop Layout */}
            <div className="hidden lg:grid lg:grid-cols-12 gap-4 h-full p-4">
                {/* Left column: hero + rules */}
                <div className="col-span-8 flex flex-col gap-4 min-h-0">
                    <Link
                        href={route('games.index')}
                        className="inline-flex items-center gap-2 text-yellow-900 hover:text-yellow-700 font-bold transition w-fit"
                    >
                        <BackArrow className="h-5 w-5" />
                        Back to Games
                    </Link>

                    <div className="relative rounded-3xl bg-gradient-to-br from-rose-100 via-amber-50 to-sky-100 shadow-2xl border-2 border-white/60 overflow-hidden">
                        {/* Animated background accents */}
                        <FloatingMarks variant="desktop" />
                        {/* Two giant blurred color pools for depth */}
                        <div
                            aria-hidden
                            className="absolute -left-20 -top-20 h-72 w-72 rounded-full blur-3xl opacity-60"
                            style={{
                                background:
                                    'radial-gradient(closest-side, rgba(255, 138, 61, 0.55), rgba(255, 138, 61, 0) 70%)',
                            }}
                        />
                        <div
                            aria-hidden
                            className="absolute -right-20 -bottom-20 h-72 w-72 rounded-full blur-3xl opacity-60"
                            style={{
                                background:
                                    'radial-gradient(closest-side, rgba(59, 130, 246, 0.5), rgba(59, 130, 246, 0) 70%)',
                            }}
                        />

                        <div className="relative z-10 flex items-center gap-8 p-10">
                            {/* Big logo block */}
                            <div className="flex-shrink-0">
                                <CubeTacLogo size="xl" layout="stacked" showTagline />
                            </div>

                            {/* Description and badges */}
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <p className="text-gray-800 text-lg leading-relaxed font-medium">
                                    {game.description}
                                </p>
                                <div className="mt-5 flex items-center gap-2 flex-wrap">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-sm text-indigo-700 font-black text-sm shadow-sm ring-1 ring-indigo-200">
                                        <UsersIcon className="h-4 w-4" />
                                        {game.min_players}-{game.max_players} players
                                    </span>
                                    {game.estimated_duration_minutes && (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-sm text-purple-700 font-black text-sm shadow-sm ring-1 ring-purple-200">
                                            <ClockIcon className="h-4 w-4" />
                                            ~{game.estimated_duration_minutes} min
                                        </span>
                                    )}
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-sm text-orange-700 font-black text-sm shadow-sm ring-1 ring-orange-200">
                                        <SparkIcon className="h-4 w-4" />
                                        3D Puzzle
                                    </span>
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
                                        <RuleItem key={key} label={key} value={value} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right column: actions */}
                <div className="col-span-4 flex flex-col gap-4 min-h-0">
                    {/* Play Local — big primary */}
                    <Link
                        href={route('cubetac.local')}
                        className="group rounded-2xl bg-gradient-to-br from-orange-500 via-rose-500 to-pink-600 shadow-lg border-b-4 border-rose-800 overflow-hidden transition hover:scale-[1.01]"
                    >
                        <div className="p-5 flex items-center gap-4">
                            <div className="h-14 w-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white">
                                <LocalIcon className="h-8 w-8" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-black text-white text-lg leading-tight">Play Locally</h3>
                                <p className="text-white/80 text-sm">Pass &amp; play on one device</p>
                            </div>
                            <div className="text-white text-2xl group-hover:translate-x-1 transition-transform">
                                →
                            </div>
                        </div>
                    </Link>

                    {/* Create online room */}
                    <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-100 shadow-lg border border-teal-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-4 py-3">
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                <GameIcon name="gamepad" size="sm" /> Online Match
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

                    <div className="rounded-2xl bg-gradient-to-br from-purple-50 to-violet-100 shadow-lg border border-purple-200 p-4">
                        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <GameIcon name="link" size="sm" /> Have a Room Code?
                        </h2>
                        <p className="mt-1 text-sm text-gray-600">Join a friend&apos;s room directly.</p>
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

// -----------------------------------------------------------------------------
// FloatingMarks — decorative X and O glyphs softly floating in the background
// of the hero card. Pure eye-candy, no interactivity.
// -----------------------------------------------------------------------------

function FloatingMarks({ variant }: { variant: 'desktop' | 'mobile' }) {
    if (variant === 'mobile') {
        return (
            <>
                <span
                    aria-hidden
                    className="absolute top-3 left-4 text-3xl font-black text-red-400/40 animate-cubeFloat"
                    style={{ animationDelay: '0s' }}
                >
                    ✕
                </span>
                <span
                    aria-hidden
                    className="absolute bottom-3 right-4 text-3xl font-black text-blue-500/40 animate-cubeFloatAlt"
                    style={{ animationDelay: '0.8s' }}
                >
                    ○
                </span>
                <span
                    aria-hidden
                    className="absolute top-8 right-8 text-xl font-black text-orange-500/30 animate-cubeFloat"
                    style={{ animationDelay: '1.5s' }}
                >
                    ✕
                </span>
            </>
        );
    }
    return (
        <>
            <span
                aria-hidden
                className="absolute top-6 left-10 text-5xl font-black text-red-400/30 animate-cubeFloat select-none"
                style={{ animationDelay: '0s' }}
            >
                ✕
            </span>
            <span
                aria-hidden
                className="absolute top-12 right-16 text-4xl font-black text-blue-500/30 animate-cubeFloatAlt select-none"
                style={{ animationDelay: '0.4s' }}
            >
                ○
            </span>
            <span
                aria-hidden
                className="absolute bottom-10 left-20 text-3xl font-black text-orange-500/30 animate-cubeFloat select-none"
                style={{ animationDelay: '1.2s' }}
            >
                ✕
            </span>
            <span
                aria-hidden
                className="absolute bottom-6 right-10 text-5xl font-black text-indigo-500/25 animate-cubeFloatAlt select-none"
                style={{ animationDelay: '2s' }}
            >
                ○
            </span>
            <span
                aria-hidden
                className="absolute top-1/2 left-1/2 text-2xl font-black text-rose-400/25 animate-cubeFloat select-none"
                style={{ animationDelay: '0.9s' }}
            >
                ✕
            </span>
        </>
    );
}

// -----------------------------------------------------------------------------
// Rule item — handles both string and nested object values
// -----------------------------------------------------------------------------

function RuleItem({ label, value }: { label: string; value: unknown }) {
    return (
        <div className="bg-white/60 rounded-xl p-4">
            <h3 className="font-bold text-yellow-800 capitalize">{label.replace(/_/g, ' ')}</h3>
            {typeof value === 'string' ? (
                <p className="mt-2 text-gray-700">{value}</p>
            ) : value && typeof value === 'object' ? (
                <ul className="mt-2 space-y-1.5">
                    {Object.entries(value as Record<string, string>).map(([subKey, subValue]) => (
                        <li key={subKey} className="flex gap-2 text-gray-700">
                            <span className="font-bold text-yellow-700">{subKey}:</span>
                            <span>{subValue}</span>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}

// -----------------------------------------------------------------------------
// Icons (inline SVGs)
// -----------------------------------------------------------------------------

function BackArrow({ className = 'h-5 w-5' }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
    );
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

function SparkIcon({ className = 'h-5 w-5' }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
            />
        </svg>
    );
}

function LocalIcon({ className = 'h-5 w-5' }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <circle cx="8" cy="9" r="3" />
            <path d="M2 20c0-3 2.5-5 6-5s6 2 6 5" />
            <circle cx="17" cy="11" r="2.5" />
            <path d="M13.5 20c0-2.2 1.8-3.5 3.5-3.5s3.5 1.3 3.5 3.5" />
        </svg>
    );
}
