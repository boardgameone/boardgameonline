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
            },
            colors: {
                brand: {
                    navy: '#2a3f5f',
                    yellow: '#f9b233',
                    blue: '#5b9bd5',
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
            },
            animation: {
                shake: 'shake 0.5s ease-in-out',
                slideIn: 'slideIn 300ms ease-out',
                confetti: 'confetti 3s ease-out forwards',
            },
        },
    },

    plugins: [forms],
};
