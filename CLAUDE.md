# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Board Game Online is a full-stack web application built with Laravel 12 (PHP 8.2+) with MySQL database. Frontend uses **React 18 + Inertia.js + TypeScript** with Tailwind CSS. Authentication scaffolded with Laravel Breeze.

## Common Commands

```bash
# Full development environment (Laravel server + Vite + Queue + Logs)
composer run dev

# Run tests (clears config cache first)
composer run test

# Initial setup (install deps, create .env, generate key, migrate)
composer run setup

# Frontend only
npm run dev     # Development with HMR
npm run build   # Production build (runs tsc && vite build)

# Database
php artisan migrate         # Run migrations
php artisan migrate:fresh   # Reset database
```

## Architecture

- **MVC Pattern**: Models in `app/Models/`, Controllers in `app/Http/Controllers/`
- **Authentication**: Laravel Breeze handles auth routes in `routes/auth.php`, controllers in `app/Http/Controllers/Auth/`
- **Routing**: Web routes in `routes/web.php` using middleware groups `['auth', 'verified']`
- **Form Validation**: Request classes in `app/Http/Requests/`

### Frontend (React + Inertia.js + TypeScript)

- **Entry Point**: `resources/js/app.tsx`
- **Pages**: `resources/js/Pages/` - React components rendered by Inertia
- **Components**: `resources/js/Components/` - Reusable React components
- **Layouts**: `resources/js/Layouts/` - AuthenticatedLayout, GuestLayout
- **Types**: `resources/js/types/` - TypeScript type definitions
- **Inertia Root**: `resources/views/app.blade.php` - Single Blade template for Inertia

### Key Libraries

- `@inertiajs/react` - Server-side routing with React
- `@headlessui/react` - Unstyled accessible UI components (Modal, Dropdown)
- `tightenco/ziggy` - Use Laravel named routes in JavaScript via `route()`

## Key Conventions

- 4-space indentation (see `.editorconfig`)
- PSR-4 autoloading with `App\` namespace
- Database changes require migrations (`php artisan make:migration`)
- Tests in `tests/Feature/` and `tests/Unit/`
- TypeScript for all frontend code (`.tsx` for components, `.ts` for utilities)
- Use `route('name')` helper from Ziggy for navigation links
