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
                'rounded border-gray-300 text-brand-teal shadow-sm focus:ring-brand-teal dark:border-gray-600 dark:bg-gray-900 ' +
                className
            }
        />
    );
}
