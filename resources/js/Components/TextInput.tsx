import {
    InputHTMLAttributes,
    useEffect,
    useRef,
} from 'react';

export default function TextInput({
    type = 'text',
    className = '',
    isFocused = false,
    ref,
    ...props
}: InputHTMLAttributes<HTMLInputElement> & {
    isFocused?: boolean;
    ref?: React.Ref<HTMLInputElement>;
}) {
    const localRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isFocused) {
            localRef.current?.focus();
        }
    }, [isFocused]);

    return (
        <input
            {...props}
            type={type}
            className={
                'rounded-md border-gray-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 sepia:border-sepia-border-strong dark:bg-gray-900 sepia:bg-sepia-bg dark:text-gray-100 sepia:text-sepia-text dark:placeholder-gray-500 sepia:placeholder-sepia-faint dark:focus:border-indigo-400 dark:focus:ring-indigo-400 ' +
                className
            }
            ref={(node) => {
                (localRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
                if (typeof ref === 'function') {
                    ref(node);
                } else if (ref) {
                    (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
                }
            }}
        />
    );
}
