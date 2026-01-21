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
                        Join a Room
                    </h2>
                </div>
            }
        >
            <Head title="Join Room" />

            <div className="py-12">
                <div className="mx-auto max-w-md sm:px-6 lg:px-8">
                    <div className="overflow-hidden rounded-xl bg-white p-8 shadow">
                        <div className="text-center mb-6">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                                <svg
                                    className="h-8 w-8 text-blue-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                    />
                                </svg>
                            </div>
                            <h3 className="mt-4 text-lg font-semibold text-gray-900">
                                Enter Room Code
                            </h3>
                            <p className="mt-1 text-sm text-gray-500">
                                Ask your friend for the 6-character room code
                            </p>
                        </div>

                        <form onSubmit={submit} className="space-y-4">
                            <div>
                                <label
                                    htmlFor="room_code"
                                    className="sr-only"
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
                                    className="block w-full rounded-lg border-gray-300 text-center text-2xl font-mono tracking-widest shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                    autoComplete="off"
                                    autoFocus
                                />
                                {errors.room_code && (
                                    <p className="mt-2 text-center text-sm text-red-600">
                                        {errors.room_code}
                                    </p>
                                )}
                            </div>

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

                            <button
                                type="submit"
                                disabled={processing || !canSubmit}
                                className="w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
                            >
                                {processing ? 'Joining...' : 'Join Room'}
                            </button>
                        </form>

                        <div className="mt-6 text-center">
                            <p className="text-sm text-gray-500">
                                Don't have a code?{' '}
                                <Link
                                    href={route('games.index')}
                                    className="font-medium text-blue-600 hover:text-blue-500"
                                >
                                    Browse available games
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </GameLayout>
    );
}
