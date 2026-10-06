import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import {
    ALargeSmall,
    Baseline,
    Eraser,
    Highlighter,
    Minus,
    Plus,
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { palette, PALETTE_LABELS } from '@/lib/palette';
import type { PaletteColor } from '@/lib/palette';
import { cn, focusRing } from '@/lib/utils';
import {
    SCALE_DEFAULT,
    SCALE_MAX,
    SCALE_MIN,
    setNoteScale,
    stepNoteScale,
    useNoteScale,
} from '../note-scale';
import {
    activeColor,
    clearColors,
    HIGHLIGHT_COLORS,
    setHighlight,
    setTextColor,
    TEXT_COLORS,
} from './color-marks';

/** Soft fill of a highlight swatch (class names written out for Tailwind). */
const HIGHLIGHT_SWATCH: Record<PaletteColor, string> = {
    gray: 'bg-tag-gray/30',
    slate: 'bg-tag-slate/30',
    teal: 'bg-tag-teal/30',
    blue: 'bg-tag-blue/30',
    green: 'bg-tag-green/30',
    amber: 'bg-tag-amber/30',
    orange: 'bg-tag-orange/30',
    red: 'bg-tag-red/30',
    violet: 'bg-tag-violet/30',
    pink: 'bg-tag-pink/30',
};

type Kind = 'textColor' | 'highlight';

const COPY: Record<Kind, { label: string; title: string }> = {
    textColor: { label: 'Warna teks', title: 'Warna teks' },
    highlight: { label: 'Stabilo', title: 'Stabilo (Ctrl/⌘ + Shift + H)' },
};

/**
 * "Warna teks" / "Stabilo" menu of the note toolbar: palette swatches
 * (light/dark aware through --tag-*) plus "Hapus warna".
 */
export function ColorMenu({
    editor,
    kind,
    buttonClassName,
}: {
    editor: Editor;
    kind: Kind;
    buttonClassName: string;
}) {
    const current = useEditorState({
        editor,
        selector: ({ editor: instance }) =>
            !instance || instance.isDestroyed || !instance.isInitialized
                ? null
                : activeColor(instance, kind),
    });
    const colors = kind === 'textColor' ? TEXT_COLORS : HIGHLIGHT_COLORS;
    const Icon = kind === 'textColor' ? Baseline : Highlighter;
    const apply = (color: PaletteColor | null) =>
        kind === 'textColor'
            ? setTextColor(editor, color)
            : setHighlight(editor, color);

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className={cn(buttonClassName, 'relative')}
                    aria-label={COPY[kind].label}
                    title={COPY[kind].title}
                    aria-pressed={current !== null}
                    onMouseDown={(event) => event.preventDefault()}
                >
                    <Icon className="size-[18px]" aria-hidden />
                    <span
                        aria-hidden
                        className={cn(
                            'absolute inset-x-2 bottom-1 h-[3px] rounded-full',
                            current ? palette(current).bg : 'bg-transparent',
                        )}
                    />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="start"
                className="w-[232px]"
                onCloseAutoFocus={(event) => {
                    // Back to the text, not the toolbar button.
                    event.preventDefault();
                    editor.commands.focus();
                }}
            >
                <DropdownMenuLabel>{COPY[kind].label}</DropdownMenuLabel>
                <div className="grid grid-cols-5 gap-1 px-1 pb-1">
                    {colors.map((color) => (
                        <DropdownMenuItem
                            key={color}
                            aria-label={`${COPY[kind].label} ${PALETTE_LABELS[color].toLowerCase()}`}
                            title={PALETTE_LABELS[color]}
                            aria-checked={current === color}
                            role="menuitemradio"
                            onSelect={() => apply(color)}
                            className="flex size-10 items-center justify-center p-0 aria-checked:ring-2 aria-checked:ring-ring"
                        >
                            {kind === 'textColor' ? (
                                <span
                                    aria-hidden
                                    className={cn(
                                        'text-[18px] font-bold',
                                        palette(color).text,
                                    )}
                                >
                                    A
                                </span>
                            ) : (
                                <span
                                    aria-hidden
                                    className={cn(
                                        'flex size-7 items-center justify-center rounded-md text-[15px] font-semibold text-text',
                                        HIGHLIGHT_SWATCH[color],
                                    )}
                                >
                                    ab
                                </span>
                            )}
                        </DropdownMenuItem>
                    ))}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onSelect={() => apply(null)}
                    disabled={current === null}
                >
                    <Eraser aria-hidden />
                    {kind === 'textColor' ? 'Warna bawaan' : 'Tanpa stabilo'}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => clearColors(editor)}>
                    <Eraser aria-hidden />
                    Hapus warna
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/**
 * A− / 100% / A+ (desktop toolbar). The size is remembered per device and
 * only applies to the note body.
 */
export function TextSizeControl({
    buttonClassName,
    large = false,
}: {
    buttonClassName: string;
    /** Bigger hit areas (phone bottom sheet). */
    large?: boolean;
}) {
    const scale = useNoteScale();

    return (
        <div
            role="group"
            aria-label="Ukuran huruf catatan"
            className={cn(
                'flex shrink-0 items-center',
                large ? 'gap-3' : 'gap-0.5',
            )}
        >
            <button
                type="button"
                className={buttonClassName}
                aria-label="Perkecil huruf"
                title="Perkecil huruf (Ctrl/⌘ + Alt + −)"
                disabled={scale <= SCALE_MIN}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => stepNoteScale(-1)}
            >
                <Minus className="size-[18px]" aria-hidden />
                <span className="sr-only">A−</span>
            </button>
            <button
                type="button"
                className={cn(
                    'flex shrink-0 items-center justify-center rounded-[10px] font-semibold text-text-muted tabular-nums transition-colors duration-120 ease-brand hover:bg-surface-2 hover:text-text',
                    large
                        ? 'h-13 min-w-24 text-[20px]'
                        : 'h-9 min-w-14 text-[14px]',
                    focusRing,
                )}
                aria-label={`Ukuran huruf ${scale}%, atur ulang ke 100%`}
                title="Atur ulang ukuran huruf"
                aria-live="polite"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setNoteScale(SCALE_DEFAULT)}
            >
                {scale}%
            </button>
            <button
                type="button"
                className={buttonClassName}
                aria-label="Perbesar huruf"
                title="Perbesar huruf (Ctrl/⌘ + Alt + =)"
                disabled={scale >= SCALE_MAX}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => stepNoteScale(1)}
            >
                <Plus className="size-[18px]" aria-hidden />
                <span className="sr-only">A+</span>
            </button>
        </div>
    );
}

/** Phone toolbar button opening "Tampilan teks" (sheet with the size control). */
export function TextSizeButton({
    buttonClassName,
    onClick,
}: {
    buttonClassName: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            className={buttonClassName}
            aria-label="Ukuran huruf"
            title="Ukuran huruf"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClick}
        >
            <ALargeSmall className="size-[18px]" aria-hidden />
        </button>
    );
}

/**
 * Ctrl/⌘ + Alt + = / − / 0 on desktop (event.code: Alt changes the key on
 * macOS). Returns true when handled.
 */
export function handleScaleShortcut(event: KeyboardEvent): boolean {
    if (!(event.ctrlKey || event.metaKey) || !event.altKey) {
        return false;
    }

    if (event.code === 'Equal' || event.code === 'NumpadAdd') {
        stepNoteScale(1);
    } else if (event.code === 'Minus' || event.code === 'NumpadSubtract') {
        stepNoteScale(-1);
    } else if (event.code === 'Digit0' || event.code === 'Numpad0') {
        setNoteScale(SCALE_DEFAULT);
    } else {
        return false;
    }

    event.preventDefault();

    return true;
}
