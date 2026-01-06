import React, { useRef, useEffect } from 'react';
import clsx from 'clsx';
import styles from './OtpInput.module.css';

interface OtpInputProps {
    length?: number;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

export const OtpInput: React.FC<OtpInputProps> = ({
    length = 6,
    value,
    onChange,
    disabled,
}) => {
    const inputs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        // Focus first input on mount if empty
        if (!value && !disabled) {
            inputs.current[0]?.focus();
        }
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const val = e.target.value;
        if (isNaN(Number(val))) return;

        const newValue = value.split('');
        // Take the last character entered
        newValue[index] = val.substring(val.length - 1);
        const newOtp = newValue.join('');
        onChange(newOtp);

        // Focus next input
        if (val && index < length - 1) {
            inputs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === 'Backspace') {
            if (!value[index] && index > 0) {
                // If empty, focus previous and delete
                inputs.current[index - 1]?.focus();
                const newValue = value.split('');
                newValue[index - 1] = '';
                onChange(newValue.join(''));
            } else {
                // Just delete current
                const newValue = value.split('');
                newValue[index] = '';
                onChange(newValue.join(''));
            }
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text/plain').slice(0, length);
        if (!/^\d+$/.test(pastedData)) return;

        onChange(pastedData);
        // Focus last filled input
        const focusIndex = Math.min(pastedData.length, length - 1);
        inputs.current[focusIndex]?.focus();
    };

    return (
        <div className={styles.container}>
            {Array.from({ length }).map((_, index) => (
                <input
                    key={index}
                    ref={(el) => { inputs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={value[index] || ''}
                    onChange={(e) => handleChange(e, index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    onPaste={handlePaste}
                    className={clsx(styles.input, { [styles.filled]: !!value[index] })}
                    disabled={disabled}
                    aria-label={`Digit ${index + 1} of ${length}`}
                />
            ))}
        </div>
    );
};
