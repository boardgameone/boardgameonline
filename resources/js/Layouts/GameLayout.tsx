import Dropdown from '@/Components/Dropdown';
import GameIcon from '@/Components/GameIcon';
import { User } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { PropsWithChildren, ReactNode, useState } from 'react';

interface GameLayoutProps {
    header?: ReactNode;
    fullHeight?: boolean;
}

export default function GameLayout({
    header,
    fullHeight = false,
    children,
}: PropsWithChildren<GameLayoutProps>) {
    const { auth } = usePage<{ auth: { user: User | null } }>().props;
    const user = auth?.user;

    const [showingNavigationDropdown, setShowingNavigationDropdown] =
        useState(false);

    return (
        <div className={`bg-gradient-to-b from-yellow-400 to-yellow-500 ${
            fullHeight ? 'h-screen flex flex-col overflow-hidden' : 'min-h-screen'
        }`}>
            {/* Nav */}
            <nav className="relative">
                {/* Gradient Background */}
                <div className="absolute inset-0 bg-gradient-to-r from-brand-blue to-brand-teal" />

                {/* Decorative elements */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-400/20 rounded-full blur-2xl" />
                    <div className="absolute top-0 left-1/2 w-24 h-24 bg-blue-400/10 rounded-full blur-xl" />
                </div>

                <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 sm:h-20 justify-between items-center">
                        {/* Logo and Nav Links */}
                        <div className="flex items-center gap-2 sm:gap-6">
                            {/* Logo */}
                            <Link href="/" className="flex items-center gap-2 sm:gap-3 group">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-yellow-400 rounded-2xl blur-sm opacity-50 group-hover:opacity-75 transition" />
                                    <div className="relative bg-white rounded-2xl p-1.5 sm:p-2 shadow-lg group-hover:scale-105 transition">
                                        <img
                                            src="/images/logo.png"
                                            alt="Board Game Online"
                                            className="h-8 sm:h-10 w-auto"
                                        />
                                    </div>
                                </div>
                                <div className="hidden md:block">
                                    <span className="text-white font-black text-lg tracking-tight">Board Game</span>
                                    <span className="text-yellow-300 font-black text-lg tracking-tight"> Online</span>
                                </div>
                            </Link>

                            {/* Desktop Nav Links */}
                            <div className="hidden sm:flex items-center gap-1 ml-4">
                                <NavLink
                                    href={route('games.index')}
                                    active={route().current('games.*')}
                                    icon={<GameIcon name="gamepad" />}
                                >
                                    Games
                                </NavLink>
                                {user && (
                                    <NavLink
                                        href={route('dashboard')}
                                        active={route().current('dashboard')}
                                        icon={<GameIcon name="home" />}
                                    >
                                        Dashboard
                                    </NavLink>
                                )}
                            </div>
                        </div>

                        {/* Right Side - User Menu */}
                        <div className="hidden sm:flex items-center gap-3">
                            {user ? (
                                <Dropdown>
                                    <Dropdown.Trigger>
                                        <button
                                            type="button"
                                            className="flex items-center gap-2 sm:gap-3 bg-white/15 backdrop-blur-sm hover:bg-white/25 rounded-full pl-2 pr-3 sm:pl-3 sm:pr-4 py-1.5 sm:py-2 transition group"
                                        >
                                            <div className="relative">
                                                <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full blur-sm opacity-75" />
                                                <span className="relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 text-white font-bold text-sm sm:text-base shadow-lg">
                                                    {user.name.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <span className="text-white font-bold text-sm sm:text-base hidden xs:block">
                                                {user.name}
                                            </span>
                                            <svg
                                                className="h-4 w-4 text-white/70 group-hover:text-white transition"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M19 9l-7 7-7-7"
                                                />
                                            </svg>
                                        </button>
                                    </Dropdown.Trigger>

                                    <Dropdown.Content align="right">
                                        <div className="px-4 py-3 border-b border-gray-100">
                                            <p className="text-sm font-bold text-gray-900">{user.name}</p>
                                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                                        </div>
                                        <Dropdown.Link href={route('profile.edit')}>
                                            <span className="flex items-center gap-2">
                                                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                </svg>
                                                Profile Settings
                                            </span>
                                        </Dropdown.Link>
                                        <Dropdown.Link
                                            href={route('logout')}
                                            method="post"
                                            as="button"
                                        >
                                            <span className="flex items-center gap-2 text-red-600">
                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                                </svg>
                                                Log Out
                                            </span>
                                        </Dropdown.Link>
                                    </Dropdown.Content>
                                </Dropdown>
                            ) : (
                                <div className="flex items-center gap-2 sm:gap-3">
                                    <Link
                                        href={route('login')}
                                        className="text-white/90 hover:text-white font-bold text-sm px-3 sm:px-4 py-2 rounded-full hover:bg-white/10 transition"
                                    >
                                        Log in
                                    </Link>
                                    <Link
                                        href={route('register')}
                                        className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-gray-900 font-bold text-sm px-4 sm:px-6 py-2 sm:py-2.5 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                                    >
                                        Play Now
                                    </Link>
                                </div>
                            )}
                        </div>

                        {/* Mobile Menu Button */}
                        <div className="flex items-center sm:hidden">
                            <button
                                onClick={() =>
                                    setShowingNavigationDropdown(
                                        (previousState) => !previousState,
                                    )
                                }
                                className="relative p-2 rounded-xl bg-white/10 hover:bg-white/20 transition"
                            >
                                <svg
                                    className="h-6 w-6 text-white"
                                    stroke="currentColor"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        className={
                                            !showingNavigationDropdown
                                                ? 'block'
                                                : 'hidden'
                                        }
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M4 6h16M4 12h16M4 18h16"
                                    />
                                    <path
                                        className={
                                            showingNavigationDropdown
                                                ? 'block'
                                                : 'hidden'
                                        }
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile menu */}
                <div
                    className={
                        (showingNavigationDropdown ? 'block' : 'hidden') +
                        ' sm:hidden relative'
                    }
                >
                    <div className="bg-white/10 backdrop-blur-lg border-t border-white/20">
                        <div className="px-4 py-3 space-y-1">
                            <MobileNavLink
                                href={route('games.index')}
                                active={route().current('games.*')}
                            >
                                <GameIcon name="gamepad" className="mr-2" />
                                Games
                            </MobileNavLink>
                            {user && (
                                <MobileNavLink
                                    href={route('dashboard')}
                                    active={route().current('dashboard')}
                                >
                                    <GameIcon name="home" className="mr-2" />
                                    Dashboard
                                </MobileNavLink>
                            )}
                        </div>

                        {user ? (
                            <div className="border-t border-white/20 px-4 py-4">
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 text-white font-bold text-lg shadow-lg">
                                        {user.name.charAt(0).toUpperCase()}
                                    </span>
                                    <div>
                                        <div className="text-white font-bold">
                                            {user.name}
                                        </div>
                                        <div className="text-white/60 text-sm">
                                            {user.email}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <MobileNavLink href={route('profile.edit')}>
                                        <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        Profile Settings
                                    </MobileNavLink>
                                    <Link
                                        method="post"
                                        href={route('logout')}
                                        as="button"
                                        className="w-full flex items-center px-4 py-3 text-red-300 hover:text-red-200 hover:bg-red-500/20 rounded-xl font-medium transition"
                                    >
                                        <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                        </svg>
                                        Log Out
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <div className="border-t border-white/20 px-4 py-4 space-y-2">
                                <Link
                                    href={route('login')}
                                    className="block w-full text-center py-3 text-white font-bold rounded-xl hover:bg-white/10 transition"
                                >
                                    Log in
                                </Link>
                                <Link
                                    href={route('register')}
                                    className="block w-full text-center py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-gray-900 font-bold rounded-xl shadow-lg"
                                >
                                    Create Account
                                </Link>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Gradient Border */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-brand-teal to-brand-cyan" />
            </nav>

            {header && (
                <header className="bg-white/80 backdrop-blur-sm shadow-sm">
                    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
                        {header}
                    </div>
                </header>
            )}

            <main className={fullHeight ? 'flex-1 overflow-auto' : 'py-6 sm:py-8'}>
                <div className={`mx-auto px-4 sm:px-6 lg:px-8 ${
                    fullHeight ? 'max-w-full h-full' : 'max-w-7xl'
                }`}>
                    {children}
                </div>
            </main>

            {/* Footer - hidden in fullHeight mode */}
            {!fullHeight && (
                <footer className="py-6 text-center">
                    <p className="text-yellow-800 font-medium text-sm flex items-center justify-center gap-2">
                        <GameIcon name="dice" size="sm" /> Play together, anywhere! <GameIcon name="gamepad" size="sm" />
                    </p>
                </footer>
            )}
        </div>
    );
}

function NavLink({
    href,
    active,
    icon,
    children,
}: Readonly<{
    href: string;
    active: boolean;
    icon?: React.ReactNode;
    children: React.ReactNode;
}>) {
    return (
        <Link
            href={href}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold transition rounded-full ${
                active
                    ? 'bg-white/25 text-white shadow-lg'
                    : 'text-white/80 hover:text-white hover:bg-white/15'
            }`}
        >
            {icon}
            <span className="hidden lg:inline">{children}</span>
        </Link>
    );
}

function MobileNavLink({
    href,
    active,
    children,
}: Readonly<{
    href: string;
    active?: boolean;
    children: React.ReactNode;
}>) {
    return (
        <Link
            href={href}
            className={`flex items-center px-4 py-3 rounded-xl font-medium transition ${
                active
                    ? 'bg-white/20 text-white'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
        >
            {children}
        </Link>
    );
}
