<?php

namespace App\Providers;

use App\Models\LocalPlaySession;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Vite::prefetch(concurrency: 3);

        RateLimiter::for('local-play', function (Request $request): Limit {
            $token = $request->header(LocalPlaySession::TOKEN_HEADER);

            return Limit::perMinute(600)->by(is_string($token) && $token !== '' ? sha1($token) : (string) $request->ip());
        });
    }
}
