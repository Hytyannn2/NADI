/**
 * Debounces a value, delaying updates until the user stops typing or changing input.
 */
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        // Sets value after delay
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        // Clears timer if value changes before delay expires
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

