<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">

        <title inertia>{{ config('app.name', 'Laravel') }}</title>

        <!-- Favicon -->
        <link rel="icon" type="image/png" href="/favicon.png">

        <!-- PWA Meta Tags -->
        <meta name="theme-color" content="#1e3a5f">
        <meta name="mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
        <meta name="apple-mobile-web-app-title" content="BGOnline">
        <link rel="apple-touch-icon" href="/pwa-icons/icon-180x180.png">
        <link rel="apple-touch-icon" sizes="152x152" href="/pwa-icons/icon-152x152.png">
        <link rel="apple-touch-icon" sizes="180x180" href="/pwa-icons/icon-180x180.png">
        <link rel="manifest" href="/build/manifest.webmanifest">

        <!-- Fonts -->
        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=figtree:400,500,600&display=swap" rel="stylesheet" />
        <link href="https://fonts.bunny.net/css?family=audiowide:400|orbitron:500,700,900|rajdhani:400,500,600,700&display=swap" rel="stylesheet" />

        <!-- Theme (must run before Vite styles to prevent flash of wrong theme) -->
        <script>
            (function () {
                try {
                    var stored = localStorage.getItem('theme');
                    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    var theme = stored || (prefersDark ? 'dark' : 'light');
                    if (theme === 'dark') {
                        document.documentElement.classList.add('dark');
                    } else if (theme === 'grayscale') {
                        document.documentElement.classList.add('grayscale');
                    }
                } catch (e) {}
            })();
        </script>

        <!-- Scripts -->
        @routes
        @viteReactRefresh
        @vite(['resources/js/app.tsx', "resources/js/Pages/{$page['component']}.tsx"])
        @inertiaHead
    </head>
    <body class="font-sans antialiased w-full min-h-screen dark:bg-gray-900 dark:text-gray-100 transition-colors duration-200">
        @inertia
    </body>
</html>
