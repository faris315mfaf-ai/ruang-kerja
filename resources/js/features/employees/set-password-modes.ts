/**
 * Choices of Admin › Karyawan › Atur kata sandi (owner decision 7 Oct 2026):
 * "Sandi bawaan" first and pre-selected when the company default password is
 * configured for this account (never for a Super Admin), then "Ketik
 * sendiri". The former random generator is gone.
 */
export type SetPasswordMode = 'default' | 'manual';

export type SetPasswordModeOption = {
    value: SetPasswordMode;
    label: string;
};

export function setPasswordModes(
    defaultAvailable: boolean,
): SetPasswordModeOption[] {
    const manual: SetPasswordModeOption = {
        value: 'manual',
        label: 'Ketik sendiri',
    };

    return defaultAvailable
        ? [{ value: 'default', label: 'Sandi bawaan' }, manual]
        : [manual];
}

export function initialSetPasswordMode(
    defaultAvailable: boolean,
): SetPasswordMode {
    return setPasswordModes(defaultAvailable)[0].value;
}

/** Fixed-length mask: hides the value and its length until revealed. */
export const MASKED_PASSWORD = '•'.repeat(10);
