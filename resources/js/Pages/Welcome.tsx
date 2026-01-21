import { PageProps } from '@/types';
import { Head, Link } from '@inertiajs/react';

export default function Welcome({ auth }: PageProps) {
    return (
        <>
            <Head title="Board Game Online" />
            <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800">
                <nav className="flex items-center justify-between p-6">
                    <div className="text-2xl font-bold text-white">
                        Board Game Online
                    </div>
                    <div className="space-x-4">
                        {auth.user ? (
                            <Link
                                href={route('dashboard')}
                                className="rounded-lg bg-white px-4 py-2 font-semibold text-purple-900 transition hover:bg-gray-100"
                            >
                                Dashboard
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href={route('login')}
                                    className="rounded-lg px-4 py-2 font-semibold text-white transition hover:bg-white/10"
                                >
                                    Log in
                                </Link>
                                <Link
                                    href={route('register')}
                                    className="rounded-lg bg-white px-4 py-2 font-semibold text-purple-900 transition hover:bg-gray-100"
                                >
                                    Register
                                </Link>
                            </>
                        )}
                    </div>
                </nav>

                <main className="flex flex-col items-center justify-center px-6 py-24">
                    <h1 className="mb-6 text-center text-5xl font-bold text-white md:text-6xl">
                        Welcome to Board Game Online
                    </h1>
                    <p className="mb-12 max-w-2xl text-center text-xl text-gray-300">
                        Play your favorite board games with friends online.
                        Create a room, invite players, and start gaming!
                    </p>

                    <div className="flex flex-col gap-4 sm:flex-row">
                        {auth.user ? (
                            <Link
                                href={route('dashboard')}
                                className="rounded-lg bg-white px-8 py-4 text-lg font-semibold text-purple-900 transition hover:bg-gray-100"
                            >
                                Go to Dashboard
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href={route('register')}
                                    className="rounded-lg bg-white px-8 py-4 text-lg font-semibold text-purple-900 transition hover:bg-gray-100"
                                >
                                    Get Started
                                </Link>
                                <Link
                                    href={route('login')}
                                    className="rounded-lg border-2 border-white px-8 py-4 text-lg font-semibold text-white transition hover:bg-white/10"
                                >
                                    Sign In
                                </Link>
                            </>
                        )}
                    </div>
                </main>

                <footer className="absolute bottom-0 w-full p-6 text-center text-gray-400">
                    Board Game Online - Play together, anywhere.
                </footer>
            </div>
        </>
    );
}
