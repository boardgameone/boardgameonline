import { InputHTMLAttributes } from 'react';

export default function Checkbox({
    className = '',
    ...props
}: InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            {...props}
            type="checkbox"
            className={
                'rounded-sm border-gray-300 text-brand-teal shadow-xs focus:ring-brand-teal dark:border-gray-600 sepia:border-sepia-border-strong dark:bg-gray-900 sepia:bg-sepia-bg ' +
                className
            }
        />
    );
}
