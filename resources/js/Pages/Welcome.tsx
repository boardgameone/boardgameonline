import { PageProps } from '@/types';
import { Head, Link } from '@inertiajs/react';

export default function Welcome({ auth }: PageProps) {
    return (
        <>
            <Head title="Board Game Online" />
            <div className="min-h-screen bg-yellow-400 relative overflow-hidden">
                {/* Fun background pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-10 left-10 w-32 h-32 bg-yellow-600 rounded-full"></div>
                    <div className="absolute top-40 right-20 w-24 h-24 bg-yellow-500 rounded-full"></div>
                    <div className="absolute bottom-32 left-1/4 w-40 h-40 bg-yellow-600 rounded-full"></div>
                    <div className="absolute bottom-20 right-1/3 w-20 h-20 bg-yellow-500 rounded-full"></div>
                    <div className="absolute top-1/2 left-1/2 w-28 h-28 bg-yellow-600 rounded-full"></div>
                </div>

                <nav className="relative flex items-center justify-between p-6">
                    <div className="flex items-center">
                        <img
                            src="/images/logo.png"
                            alt="Board Game Online"
                            className="h-12 w-auto drop-shadow-lg"
                        />
                    </div>
                    <div className="flex gap-3">
                        {auth.user ? (
                            <Link
                                href={route('dashboard')}
                                className="rounded-full bg-blue-600 px-6 py-2.5 font-bold text-white shadow-lg transition transform hover:scale-105 hover:bg-blue-700 border-b-4 border-blue-800"
                            >
                                Dashboard
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href={route('login')}
                                    className="rounded-full bg-white px-6 py-2.5 font-bold text-yellow-600 shadow-lg transition transform hover:scale-105 border-b-4 border-yellow-500"
                                >
                                    Log in
                                </Link>
                                <Link
                                    href={route('register')}
                                    className="rounded-full bg-blue-600 px-6 py-2.5 font-bold text-white shadow-lg transition transform hover:scale-105 hover:bg-blue-700 border-b-4 border-blue-800"
                                >
                                    Register
                                </Link>
                            </>
                        )}
                    </div>
                </nav>

                <main className="relative flex flex-col items-center justify-center px-6 py-20">
                    <h1 className="mb-6 text-center text-5xl md:text-7xl font-black text-white drop-shadow-[3px_3px_0px_rgba(0,0,0,0.3)] tracking-tight">
                        Welcome to
                        <br />
                        <span className="text-blue-600 drop-shadow-[3px_3px_0px_rgba(255,255,255,0.5)]">
                            Board Game Online!
                        </span>
                    </h1>
                    <p className="mb-12 max-w-2xl text-center text-xl md:text-2xl font-semibold text-yellow-900">
                        Play your favorite board games with friends online.
                        <br />
                        Create a room, invite players, and start gaming!
                    </p>

                    <div className="flex flex-col gap-4 sm:flex-row">
                        {auth.user ? (
                            <Link
                                href={route('dashboard')}
                                className="rounded-full bg-blue-600 px-10 py-5 text-xl font-black text-white shadow-xl transition transform hover:scale-110 hover:bg-blue-700 border-b-4 border-blue-800"
                            >
                                Go to Dashboard
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href={route('register')}
                                    className="rounded-full bg-blue-600 px-10 py-5 text-xl font-black text-white shadow-xl transition transform hover:scale-110 hover:bg-blue-700 border-b-4 border-blue-800"
                                >
                                    Get Started!
                                </Link>
                                <Link
                                    href={route('login')}
                                    className="rounded-full bg-white px-10 py-5 text-xl font-black text-yellow-600 shadow-xl transition transform hover:scale-110 border-b-4 border-yellow-500"
                                >
                                    Sign In
                                </Link>
                            </>
                        )}
                    </div>
                </main>

                <footer className="absolute bottom-0 w-full p-6 text-center font-bold text-yellow-800">
                    Board Game Online - Play together, anywhere! 🎲
                </footer>
            </div>
        </>
    );
}
