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
                'rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 ' +
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
