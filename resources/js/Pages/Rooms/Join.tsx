import GameIcon from '@/Components/GameIcon';
import GameLayout from '@/Layouts/GameLayout';
import { PageProps } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

export default function Join({ auth }: PageProps) {
    const { data, setData, post, processing, errors } = useForm({
        room_code: '',
        nickname: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('rooms.join.submit'));
    };

    const canSubmit = data.room_code.length === 6 && (auth.user || data.nickname.length >= 2);

    return (
        <GameLayout>
            <Head title="Join Room" />

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

            <div className="max-w-md mx-auto">
                <div className="bg-white rounded-3xl shadow-xl overflow-hidden border-b-8 border-blue-500">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8 text-center">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full mb-4 text-white">
                            <GameIcon name="link" size="xl" />
                        </div>
                        <h1 className="text-2xl font-black text-white">
                            Join a Room
                        </h1>
                        <p className="text-blue-100 mt-1">
                            Enter the 6-character room code
                        </p>
                    </div>

                    {/* Form */}
                    <div className="p-6 sm:p-8">
                        <form onSubmit={submit} className="space-y-5">
                            <div>
                                <label
                                    htmlFor="room_code"
                                    className="block text-sm font-bold text-gray-700 mb-2 text-center"
                                >
                                    Room Code
                                </label>
                                <input
                                    id="room_code"
                                    type="text"
                                    value={data.room_code}
                                    onChange={(e) =>
                                        setData('room_code', e.target.value.toUpperCase())
                                    }
                                    placeholder="ABCD12"
                                    maxLength={6}
                                    className="w-full px-6 py-4 rounded-xl border-2 border-gray-200 text-center text-3xl font-mono tracking-[0.5em] focus:border-blue-400 focus:ring-blue-400 transition-colors uppercase"
                                    autoComplete="off"
                                    autoFocus
                                />
                                {errors.room_code && (
                                    <p className="mt-2 text-center text-sm text-red-600 font-medium">
                                        {errors.room_code}
                                    </p>
                                )}
                            </div>

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
                                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-400 focus:ring-blue-400 transition-colors font-medium"
                                        required
                                    />
                                    {errors.nickname && (
                                        <p className="mt-1 text-sm text-red-600">
                                            {errors.nickname}
                                        </p>
                                    )}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={processing || !canSubmit}
                                className="w-full rounded-full bg-blue-600 px-6 py-4 font-bold text-white text-lg shadow-lg transition hover:scale-105 hover:bg-blue-700 border-b-4 border-blue-800 disabled:opacity-50 disabled:hover:scale-100"
                            >
                                {processing ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                                fill="none"
                                            />
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                            />
                                        </svg>
                                        Joining...
                                    </span>
                                ) : (
                                    'Join Room'
                                )}
                            </button>
                        </form>

                        <div className="mt-8 text-center">
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200" />
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="bg-white px-4 text-gray-500">
                                        or
                                    </span>
                                </div>
                            </div>
                            <p className="mt-4 text-gray-600">
                                Don't have a code?{' '}
                                <Link
                                    href={route('games.index')}
                                    className="font-bold text-blue-600 hover:text-blue-700"
                                >
                                    Browse games
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Tips */}
                <div className="mt-6 bg-white/60 backdrop-blur-sm rounded-2xl p-5">
                    <h3 className="font-bold text-yellow-900 flex items-center gap-2">
                        <GameIcon name="lightbulb" size="sm" /> Tips
                    </h3>
                    <ul className="mt-2 space-y-2 text-sm text-yellow-800">
                        <li className="flex items-start gap-2">
                            <span className="text-yellow-600"><GameIcon name="circle" size="xs" /></span>
                            Ask your friend for the room code
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-yellow-600"><GameIcon name="circle" size="xs" /></span>
                            Codes are 6 characters (letters and numbers)
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-yellow-600"><GameIcon name="circle" size="xs" /></span>
                            Make sure the room hasn't started yet
                        </li>
                    </ul>
                </div>
            </div>
        </GameLayout>
    );
}
