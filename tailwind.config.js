import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './storage/framework/views/*.php',
        './resources/views/**/*.blade.php',
        './resources/js/**/*.tsx',
    ],

    theme: {
        extend: {
            fontFamily: {
                sans: ['Figtree', ...defaultTheme.fontFamily.sans],
                display: ['Audiowide', 'cursive'],
                techDisplay: ['Orbitron', 'sans-serif'],
                techBody: ['Rajdhani', 'sans-serif'],
            },
            colors: {
                brand: {
                    navy: '#2a3f5f',
                    yellow: '#f9b233',
                    blue: '#5b9bd5',
                    teal: '#14b8a6',
                    cyan: '#06b6d4',
                },
                cube: {
                    'bg-deep': '#050810',
                    bg: '#0a0f1f',
                    'bg-soft': '#131a2e',
                    line: '#1a2440',
                    x: '#ff4d2e',
                    'x-glow': '#ff7a4d',
                    o: '#3a90ff',
                    'o-glow': '#5fb3ff',
                    accent: '#ff8a3d',
                    cyan: '#4cc9ff',
                },
            },
            keyframes: {
                shake: {
                    '0%, 100%': { transform: 'translateX(0)' },
                    '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
                    '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
                },
                slideIn: {
                    from: { opacity: '0', transform: 'translateY(10px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
                confetti: {
                    '0%': { transform: 'translateY(0) rotateZ(0deg)', opacity: '1' },
                    '100%': { transform: 'translateY(100vh) rotateZ(360deg)', opacity: '0' },
                },
                glowPulse: {
                    '0%, 100%': { filter: 'brightness(1) drop-shadow(0 0 8px currentColor)' },
                    '50%': { filter: 'brightness(1.4) drop-shadow(0 0 18px currentColor)' },
                },
                winReveal: {
                    from: { opacity: '0', transform: 'translateY(24px) scale(0.9)' },
                    to: { opacity: '1', transform: 'translateY(0) scale(1)' },
                },
                tutorialPulse: {
                    '0%, 100%': { transform: 'scale(1)', opacity: '0.85' },
                    '50%': { transform: 'scale(1.15)', opacity: '1' },
                },
                tutorialSwipe: {
                    '0%, 10%': { transform: 'translateX(-32px) scale(1)', opacity: '0' },
                    '15%': { opacity: '1' },
                    '80%': { transform: 'translateX(32px) scale(0.9)', opacity: '1' },
                    '90%, 100%': { transform: 'translateX(32px) scale(0.9)', opacity: '0' },
                },
                scanlines: {
                    '0%': { transform: 'translateY(0)' },
                    '100%': { transform: 'translateY(4px)' },
                },
                cubeRotateSlow: {
                    from: { transform: 'rotateX(-20deg) rotateY(0deg)' },
                    to: { transform: 'rotateX(-20deg) rotateY(360deg)' },
                },
                cubeFloat: {
                    '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
                    '50%': { transform: 'translateY(-10px) rotate(6deg)' },
                },
                cubeFloatAlt: {
                    '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
                    '50%': { transform: 'translateY(-8px) rotate(-5deg)' },
                },
            },
            animation: {
                shake: 'shake 0.5s ease-in-out',
                slideIn: 'slideIn 300ms ease-out',
                confetti: 'confetti 3s ease-out forwards',
                glowPulse: 'glowPulse 2s ease-in-out infinite',
                winReveal: 'winReveal 700ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
                tutorialPulse: 'tutorialPulse 1.6s ease-in-out infinite',
                tutorialSwipe: 'tutorialSwipe 2.4s ease-in-out infinite',
                scanlines: 'scanlines 120ms linear infinite',
                cubeRotateSlow: 'cubeRotateSlow 18s linear infinite',
                cubeFloat: 'cubeFloat 5s ease-in-out infinite',
                cubeFloatAlt: 'cubeFloatAlt 6s ease-in-out infinite',
            },
        },
    },

    plugins: [forms],
};
