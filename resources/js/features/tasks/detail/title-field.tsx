import { useState } from 'react';
import { cn } from '@/lib/utils';

type Props = {
    value: string;
    editable: boolean;
    onSave: (title: string) => void;
    className?: string;
    /**
     * Mobile: show the large heading and switch to a 16px textarea on tap
     * (inputs are forced to 16px on phones to avoid iOS zoom).
     */
    tapToEdit?: boolean;
};

/** Inline-editable task title: Enter saves, Esc cancels, blur saves. */
export function TitleField({
    value,
    editable,
    onSave,
    className,
    tapToEdit = false,
}: Props) {
    const [draft, setDraft] = useState(value);
    const [editing, setEditing] = useState(!tapToEdit);
    const [prev, setPrev] = useState(value);

    if (prev !== value) {
        setPrev(value);
        setDraft(value);
    }

    const commit = () => {
        const title = draft.trim();

        if (tapToEdit) {
            setEditing(false);
        }

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

    if (!editing) {
        return (
            <h1 className={cn('font-semibold text-text', className)}>
                <button
                    type="button"
                    onClick={() => setEditing(true)}
                    aria-label={`Ubah judul: ${value}`}
                    className="w-full text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                    {value}
                </button>
            </h1>
        );
    }

    return (
        <textarea
            // eslint-disable-next-line jsx-a11y/no-autofocus -- opened by an explicit tap on the title
            autoFocus={tapToEdit}
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
                '-mx-1.5 field-sizing-content w-[calc(100%+0.75rem)] resize-none rounded-md border border-transparent bg-transparent px-1 py-0.5 font-semibold text-text hover:border-border focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                className,
            )}
        />
    );
}
