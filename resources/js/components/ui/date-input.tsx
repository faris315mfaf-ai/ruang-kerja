import { CalendarDays, X } from 'lucide-react';
import * as React from 'react';
import { flushSync } from 'react-dom';

import { fieldClasses } from '@/components/ui/input';
import {
    clampIsoDay,
    dateInputMessage,
    isIsoDay,
    maskDateDraft,
    parseDateInput,
    resolveDateInput,
    shiftIsoDay,
    type DateInputProblem,
} from '@/lib/date-input';
import { formatDayDate, formatNumericDate, toIsoDay } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Opens the browser/OS date picker of a (visually hidden) `type="date"` input.
 * `showPicker()` needs a user gesture and is missing in older browsers, so it
 * falls back to focusing and clicking the input (iOS opens its wheel on focus).
 */
function openNativePicker(input: HTMLInputElement | null): void {
    if (!input || input.disabled) {
        return;
    }

    try {
        if (typeof input.showPicker === 'function') {
            input.showPicker();

            return;
        }
    } catch {
        // NotAllowedError (no user gesture, cross-origin frame): fall back.
    }

    input.focus();
    input.click();
}

/**
 * Hidden native date input: the source of the OS calendar. It covers its
 * positioned parent so the desktop popup opens under the field, but never
 * takes pointer events, tab focus or screen-reader attention.
 */
function NativeDatePicker({
    inputRef,
    value,
    min,
    max,
    disabled,
    onPick,
}: {
    inputRef: React.RefObject<HTMLInputElement | null>;
    value: string;
    min?: string;
    max?: string;
    disabled?: boolean;
    onPick: (value: string) => void;
}) {
    return (
        <input
            ref={inputRef}
            type="date"
            tabIndex={-1}
            aria-hidden
            data-slot="date-input-native"
            value={isIsoDay(value) ? value : ''}
            min={min || undefined}
            max={max || undefined}
            disabled={disabled}
            onChange={(event) => onPick(event.target.value)}
            className="pointer-events-none absolute inset-0 size-full opacity-0"
        />
    );
}

type DateInputSize = 'default' | 'sm';

export type DateInputProps = {
    /** "YYYY-MM-DD" or '' (empty). */
    value: string;
    /** Called with "YYYY-MM-DD" or '' (cleared) once a change is committed. */
    onChange: (value: string) => void;
    min?: string;
    max?: string;
    id?: string;
    /** Adds `<input type="hidden" name>` holding "YYYY-MM-DD" for plain forms. */
    name?: string;
    required?: boolean;
    /**
     * Whether the field may be emptied (× button, deleting the text). Defaults
     * to `!required`; pass `false` for dates the form always needs without
     * turning on native `required` validation.
     */
    clearable?: boolean;
    disabled?: boolean;
    /** Shown when empty and not focused. Default "Pilih tanggal". */
    placeholder?: string;
    size?: DateInputSize;
    /** Wrapper (width, margins). */
    className?: string;
    /** The visible text box (height, font size). */
    inputClassName?: string;
    onBlur?: () => void;
    ref?: React.Ref<HTMLInputElement>;
    'aria-invalid'?: boolean | 'true' | 'false';
    'aria-describedby'?: string;
    'aria-label'?: string;
    'aria-labelledby'?: string;
};

/**
 * Arus date field ("Senin, 30/10/2026"), independent of the browser language.
 *
 * - Not focused: the value as "Senin, 30/10/2026" (`formatDayDate`).
 * - Focused: editable "dd/mm/yyyy"; also accepts d/m/yyyy, dd-mm-yyyy,
 *   dd.mm.yyyy, ddmmyyyy and ISO. A "/" is inserted after day and month while
 *   typing. ↑/↓ step one day (within min/max), Alt+↓ opens the calendar,
 *   Esc undoes the typing.
 * - The text is committed on blur and on Enter (synchronously, so a form
 *   submitted by that Enter already sees the new value).
 * - Invalid text, a date outside min/max, or emptying a non-clearable field
 *   keeps the previous value and shows one short message under the field
 *   (`aria-invalid` + linked through `aria-describedby`, announced politely).
 *   The caller's own error (server validation) stays the caller's: pass
 *   `aria-invalid` / `aria-describedby` as with any input.
 * - The calendar button opens the OS/browser picker (phones keep their native
 *   picker); the × button clears the value when the field is clearable.
 */
function DateInput({
    value,
    onChange,
    min,
    max,
    id,
    name,
    required = false,
    clearable,
    disabled = false,
    placeholder = 'Pilih tanggal',
    size = 'default',
    className,
    inputClassName,
    onBlur,
    ref,
    'aria-invalid': ariaInvalid,
    'aria-describedby': ariaDescribedBy,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
}: DateInputProps) {
    const generatedId = React.useId();
    const inputId = id ?? `date-${generatedId}`;
    const hintId = `${inputId}-format`;
    const messageId = `${inputId}-message`;

    const textRef = React.useRef<HTMLInputElement | null>(null);
    const nativeRef = React.useRef<HTMLInputElement | null>(null);
    /** Pending "select all on focus"; dropped as soon as the user types. */
    const selectFrame = React.useRef<number | null>(null);
    const cancelSelect = () => {
        if (selectFrame.current !== null) {
            cancelAnimationFrame(selectFrame.current);
            selectFrame.current = null;
        }
    };
    const [editing, setEditing] = React.useState(false);
    const [draft, setDraft] = React.useState('');
    const [problem, setProblem] = React.useState<DateInputProblem | null>(null);

    const current = isIsoDay(value) ? value : '';
    const allowEmpty = (clearable ?? !required) && !required;
    const editable = current ? formatNumericDate(current) : '';
    const display = editing ? draft : current ? formatDayDate(current) : '';

    const setRefs = (node: HTMLInputElement | null) => {
        textRef.current = node;

        if (typeof ref === 'function') {
            ref(node);
        } else if (ref) {
            ref.current = node;
        }
    };

    /** Commits `text`; returns false when it was rejected. */
    const commit = (text: string, sync = false): boolean => {
        if (text.trim() === editable) {
            setProblem(null);

            return true;
        }

        const result = resolveDateInput(text, { min, max, allowEmpty });

        if ('problem' in result) {
            setProblem(result.problem);

            return false;
        }

        setProblem(null);

        if (result.value !== current) {
            if (sync) {
                flushSync(() => onChange(result.value));
            } else {
                onChange(result.value);
            }
        }

        return true;
    };

    const pick = (picked: string) => {
        if (picked === '') {
            if (allowEmpty && current !== '') {
                onChange('');
            }

            return;
        }

        if (isIsoDay(picked)) {
            setProblem(null);
            setDraft(formatNumericDate(picked));

            if (picked !== current) {
                onChange(picked);
            }
        }
    };

    /** ↑/↓: moves the typed (or current) date by one day; empty → today. */
    const step = (days: number) => {
        const base = parseDateInput(draft) || current;
        const today = toIsoDay(new Date()) ?? '';
        const next = base ? shiftIsoDay(base, days) : today;

        if (next) {
            setProblem(null);
            setDraft(formatNumericDate(clampIsoDay(next, min, max)));
        }
    };

    const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        cancelSelect();

        if (event.key === 'Enter') {
            if (!commit(draft, true)) {
                // Keep the form from submitting the previous value silently.
                event.preventDefault();

                return;
            }

            const committed = parseDateInput(draft);
            setDraft(committed ? formatNumericDate(committed) : '');

            return;
        }

        if (event.key === 'ArrowDown' && event.altKey) {
            event.preventDefault();
            openNativePicker(nativeRef.current);

            return;
        }

        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            step(event.key === 'ArrowUp' ? 1 : -1);

            return;
        }

        if (event.key === 'Escape' && draft !== editable) {
            event.preventDefault();
            event.stopPropagation();
            setDraft(editable);
            setProblem(null);
        }
    };

    const showClear = allowEmpty && current !== '' && !disabled;
    const describedBy =
        [ariaDescribedBy, hintId, problem ? messageId : null]
            .filter(Boolean)
            .join(' ') || undefined;
    const invalid =
        problem !== null ||
        ariaInvalid === true ||
        ariaInvalid === 'true' ||
        undefined;

    return (
        <div
            data-slot="date-input"
            className={cn('flex w-full min-w-0 flex-col', className)}
        >
            <div className="relative">
                <input
                    ref={setRefs}
                    id={inputId}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    spellCheck={false}
                    value={display}
                    // Full text when a narrow box ellipsizes it.
                    title={!editing && current ? display : undefined}
                    placeholder={editing ? 'dd/mm/yyyy' : placeholder}
                    required={required}
                    disabled={disabled}
                    aria-label={ariaLabel}
                    aria-labelledby={ariaLabelledBy}
                    aria-invalid={invalid}
                    aria-describedby={describedBy}
                    onFocus={(event) => {
                        setEditing(true);
                        setDraft(editable);
                        const target = event.currentTarget;
                        cancelSelect();
                        // After the click that focused it, so the caret
                        // placement does not undo the selection.
                        selectFrame.current = requestAnimationFrame(() => {
                            selectFrame.current = null;
                            if (document.activeElement === target) {
                                target.select();
                            }
                        });
                    }}
                    onChange={(event) => {
                        cancelSelect();
                        const next = event.target.value;
                        setProblem(null);
                        setDraft((previous) => maskDateDraft(previous, next));
                    }}
                    onBlur={() => {
                        cancelSelect();
                        commit(draft);
                        setEditing(false);
                        onBlur?.();
                    }}
                    onKeyDown={onKeyDown}
                    className={cn(
                        fieldClasses,
                        'flex py-1 text-ellipsis tabular-nums',
                        size === 'sm'
                            ? 'h-control-sm max-md:h-11'
                            : 'h-11 max-md:h-12',
                        showClear
                            ? 'pr-[84px] max-md:pr-[92px]'
                            : 'pr-12 max-md:pr-[52px]',
                        inputClassName,
                    )}
                />
                <NativeDatePicker
                    inputRef={nativeRef}
                    value={current}
                    min={min}
                    max={max}
                    disabled={disabled}
                    onPick={pick}
                />
                {name && <input type="hidden" name={name} value={current} />}
                <div className="absolute inset-y-0 right-0 flex items-stretch pr-0.5">
                    {showClear && (
                        <button
                            type="button"
                            aria-label="Hapus tanggal"
                            aria-controls={inputId}
                            onClick={() => {
                                setProblem(null);
                                // Synchronous, so the focus below starts
                                // editing the emptied value.
                                flushSync(() => onChange(''));
                                textRef.current?.focus();
                            }}
                            className="group flex w-9 items-center justify-center text-text-muted outline-none max-md:w-11"
                        >
                            <span className="grid size-8 place-items-center rounded-[10px] transition-colors duration-120 ease-brand group-hover:bg-surface-2 group-hover:text-text group-focus-visible:ring-[3px] group-focus-visible:ring-ring">
                                <X className="size-4" aria-hidden />
                            </span>
                        </button>
                    )}
                    <button
                        type="button"
                        aria-label="Buka kalender"
                        aria-controls={inputId}
                        disabled={disabled}
                        onClick={() => openNativePicker(nativeRef.current)}
                        className="group flex w-11 items-center justify-center text-text-muted outline-none disabled:cursor-not-allowed disabled:text-text-subtle"
                    >
                        <span className="grid size-9 place-items-center rounded-[10px] transition-colors duration-120 ease-brand group-hover:bg-surface-2 group-hover:text-primary group-focus-visible:ring-[3px] group-focus-visible:ring-ring group-disabled:bg-transparent">
                            <CalendarDays className="size-5" aria-hidden />
                        </span>
                    </button>
                </div>
            </div>
            <span id={hintId} className="sr-only">
                Format tanggal dd/mm/yyyy.
            </span>
            <p
                id={messageId}
                aria-live="polite"
                className={cn(
                    'text-meta font-semibold text-danger',
                    problem ? 'mt-1.5' : 'sr-only',
                )}
            >
                {problem ? dateInputMessage(problem, min, max) : ''}
            </p>
        </div>
    );
}

/**
 * A button that opens the OS/browser date picker, for places that already
 * show the date in their own words (task property pills, the "Pilih…" tile).
 * The picked "YYYY-MM-DD" flows to `onChange`; '' when the picker's clear
 * action is used.
 */
function DatePickerTrigger({
    value,
    onChange,
    min,
    max,
    disabled,
    className,
    containerClassName,
    children,
    ...props
}: Omit<React.ComponentProps<'button'>, 'value' | 'onChange'> & {
    value: string | null;
    onChange: (value: string) => void;
    min?: string;
    max?: string;
    containerClassName?: string;
}) {
    const nativeRef = React.useRef<HTMLInputElement | null>(null);

    return (
        <span
            data-slot="date-picker-trigger"
            className={cn('relative inline-flex', containerClassName)}
        >
            <button
                type="button"
                disabled={disabled}
                onClick={() => openNativePicker(nativeRef.current)}
                className={className}
                {...props}
            >
                {children}
            </button>
            <NativeDatePicker
                inputRef={nativeRef}
                value={value ?? ''}
                min={min}
                max={max}
                disabled={disabled}
                onPick={onChange}
            />
        </span>
    );
}

export { DateInput, DatePickerTrigger, openNativePicker };
