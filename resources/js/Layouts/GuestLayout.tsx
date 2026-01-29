import { Link } from '@inertiajs/react';
import { PropsWithChildren } from 'react';

export default function Guest({ children }: PropsWithChildren) {
    return (
        <div className="min-h-screen bg-yellow-400 flex flex-col">
            {/* Nav */}
            <nav className="flex items-center justify-between p-4 sm:p-6 shrink-0">
                <Link href="/" className="group">
                    <div className="relative">
                        <div className="absolute inset-0 bg-white rounded-2xl blur-sm opacity-50 group-hover:opacity-75 transition" />
                        <div className="relative bg-white rounded-2xl p-2 sm:p-2.5 shadow-lg group-hover:scale-105 transition">
                            <img
                                src="/images/logo.png"
                                alt="Board Game Online"
                                className="h-8 sm:h-10 w-auto"
                            />
                        </div>
                    </div>
                </Link>
                <div className="flex gap-2 sm:gap-3">
                    <Link
                        href={route('login')}
                        className="rounded-full bg-white px-4 sm:px-6 py-2 font-bold text-yellow-600 shadow-lg transition hover:scale-105 border-b-4 border-yellow-500 text-sm sm:text-base"
                    >
                        Log in
                    </Link>
                    <Link
                        href={route('register')}
                        className="rounded-full bg-blue-600 px-4 sm:px-6 py-2 font-bold text-white shadow-lg transition hover:scale-105 hover:bg-blue-700 border-b-4 border-blue-800 text-sm sm:text-base"
                    >
                        Register
                    </Link>
                </div>
            </nav>

            {/* Main content */}
            <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-8">
                {/* Decorative dice */}
                <div className="absolute top-20 left-10 text-4xl opacity-20 rotate-12 hidden lg:block">
                    {'\u{1F3B2}'}
                </div>
                <div className="absolute bottom-20 right-10 text-5xl opacity-20 -rotate-12 hidden lg:block">
                    {'\u{1F3B2}'}
                </div>
                <div className="absolute top-40 right-20 text-3xl opacity-15 rotate-45 hidden lg:block">
                    {'\u{1F0CF}'}
                </div>
                <div className="absolute bottom-40 left-20 text-4xl opacity-15 -rotate-45 hidden lg:block">
                    {'\u{265F}'}
                </div>

                {/* Card container */}
                <div className="w-full max-w-md">
                    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border-b-8 border-blue-500">
                        <div className="p-8">
                            {children}
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="p-3 text-center text-yellow-800 font-medium text-sm shrink-0">
                Play together, anywhere!
            </footer>
        </div>
    );
}
