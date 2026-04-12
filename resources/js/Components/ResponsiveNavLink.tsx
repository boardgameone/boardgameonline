import { InertiaLinkProps, Link } from '@inertiajs/react';

export default function ResponsiveNavLink({
    active = false,
    className = '',
    children,
    ...props
}: InertiaLinkProps & { active?: boolean }) {
    return (
        <Link
            {...props}
            className={`flex w-full items-start border-l-4 py-2 pe-4 ps-3 ${
                active
                    ? 'border-brand-teal bg-teal-50 text-teal-700 focus:border-teal-700 focus:bg-teal-100 focus:text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 dark:focus:bg-teal-900/60'
                    : 'border-transparent text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800 focus:border-gray-300 focus:bg-gray-50 focus:text-gray-800 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200 dark:focus:bg-gray-700 dark:focus:text-gray-200'
            } text-base font-medium transition duration-150 ease-in-out focus:outline-hidden ${className}`}
        >
            {children}
        </Link>
    );
}
