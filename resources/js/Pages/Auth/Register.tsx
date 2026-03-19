import GameIcon from '@/Components/GameIcon';
import InputError from '@/Components/InputError';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

export default function Register() {
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route('register'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <GuestLayout>
            <Head title="Register" />

            {/* Header */}
            <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full mb-4 shadow-lg text-white">
                    <GameIcon name="trophy" size="lg" />
                </div>
                <h1 className="text-2xl font-black text-gray-900">
                    Join the Fun!
                </h1>
                <p className="text-gray-500 mt-1">
                    Create your player account
                </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
                <div>
                    <label
                        htmlFor="name"
                        className="block text-sm font-bold text-gray-700 mb-1"
                    >
                        Player Name
                    </label>
                    <input
                        id="name"
                        name="name"
                        value={data.name}
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-400 focus:ring-blue-400 transition-colors font-medium"
                        autoComplete="name"
                        autoFocus
                        placeholder="Your awesome nickname"
                        onChange={(e) => setData('name', e.target.value)}
                        required
                    />
                    <InputError message={errors.name} className="mt-2" />
                </div>

                <div>
                    <label
                        htmlFor="email"
                        className="block text-sm font-bold text-gray-700 mb-1"
                    >
                        Email
                    </label>
                    <input
                        id="email"
                        type="email"
                        name="email"
                        value={data.email}
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-400 focus:ring-blue-400 transition-colors font-medium"
                        autoComplete="username"
                        placeholder="you@example.com"
                        onChange={(e) => setData('email', e.target.value)}
                        required
                    />
                    <InputError message={errors.email} className="mt-2" />
                </div>

                <div>
                    <label
                        htmlFor="password"
                        className="block text-sm font-bold text-gray-700 mb-1"
                    >
                        Password
                    </label>
                    <input
                        id="password"
                        type="password"
                        name="password"
                        value={data.password}
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-400 focus:ring-blue-400 transition-colors font-medium"
                        autoComplete="new-password"
                        placeholder="Create a strong password"
                        onChange={(e) => setData('password', e.target.value)}
                        required
                    />
                    <InputError message={errors.password} className="mt-2" />
                </div>

                <div>
                    <label
                        htmlFor="password_confirmation"
                        className="block text-sm font-bold text-gray-700 mb-1"
                    >
                        Confirm Password
                    </label>
                    <input
                        id="password_confirmation"
                        type="password"
                        name="password_confirmation"
                        value={data.password_confirmation}
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-400 focus:ring-blue-400 transition-colors font-medium"
                        autoComplete="new-password"
                        placeholder="Confirm your password"
                        onChange={(e) =>
                            setData('password_confirmation', e.target.value)
                        }
                        required
                    />
                    <InputError
                        message={errors.password_confirmation}
                        className="mt-2"
                    />
                </div>

                <button
                    type="submit"
                    disabled={processing}
                    className="w-full rounded-full bg-blue-600 px-6 py-3 font-bold text-white shadow-lg transition hover:scale-105 hover:bg-blue-700 border-b-4 border-blue-800 disabled:opacity-50 disabled:hover:scale-100"
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
                            Creating account...
                        </span>
                    ) : (
                        "Start Playing!"
                    )}
                </button>
            </form>

            <div className="mt-6 text-center">
                <p className="text-gray-600">
                    Already a player?{' '}
                    <Link
                        href={route('login')}
                        className="font-bold text-blue-600 hover:text-blue-700"
                    >
                        Log in here
                    </Link>
                </p>
            </div>
        </GuestLayout>
    );
}
