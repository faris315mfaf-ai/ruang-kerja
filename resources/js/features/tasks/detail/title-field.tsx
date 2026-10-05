import { useState } from 'react';
import { cn } from '@/lib/utils';

type Props = {
    value: string;
    editable: boolean;
    onSave: (title: string) => void;
    className?: string;
};

/** Inline-editable task title: Enter saves, Esc cancels, blur saves. */
export function TitleField({ value, editable, onSave, className }: Props) {
    const [draft, setDraft] = useState(value);
    const [prev, setPrev] = useState(value);

    if (prev !== value) {
        setPrev(value);
        setDraft(value);
    }

    const commit = () => {
        const title = draft.trim();

        if (title === '' || title === value) {
            setDraft(value);

            return;
        }

        onSave(title);
    };

    if (!editable) {
        return (
            <h1 className={cn('font-semibold text-text', className)}>
                {value}
            </h1>
        );
    }

    return (
        <textarea
            aria-label="Judul tugas"
            value={draft}
            rows={1}
            maxLength={255}
            onChange={(event) =>
                setDraft(event.target.value.replace(/\n/g, ''))
            }
            onBlur={commit}
            onKeyDown={(event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    event.currentTarget.blur();
                }

                if (event.key === 'Escape') {
                    event.stopPropagation();
                    setDraft(value);
                    requestAnimationFrame(() => event.currentTarget?.blur());
                }
            }}
            className={cn(
                'field-sizing-content w-full resize-none rounded-md border border-transparent bg-transparent px-1 py-0.5 font-semibold text-text hover:border-border focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                className,
            )}
        />
    );
}
