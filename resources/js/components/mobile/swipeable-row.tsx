import type { LucideIcon } from 'lucide-react';
import type { PointerEvent, ReactNode } from 'react';
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export type SwipeAction = {
    label: string;
    onAction: () => void;
    tone?: 'primary' | 'info' | 'danger' | 'neutral';
    /** Optional icon above the label (mockup MInbox). */
    icon?: LucideIcon;
};

type Props = {
    children: ReactNode;
    /** Revealed when swiping left (right edge). */
    actions: SwipeAction[];
    /** Revealed when swiping right (left edge), e.g. "Selesai". */
    leadingActions?: SwipeAction[];
    className?: string;
};

const ACTION_WIDTH = 80;

const toneClass: Record<NonNullable<SwipeAction['tone']>, string> = {
    primary: 'bg-primary text-primary-foreground',
    info: 'bg-accent-blue-strong text-on-brand',
    danger: 'bg-danger text-on-danger',
    neutral: 'bg-surface-2 text-text',
};

function ActionButtons({
    actions,
    hidden,
    onDone,
}: {
    actions: SwipeAction[];
    hidden: boolean;
    onDone: () => void;
}) {
    return actions.map((action) => (
        <button
            key={action.label}
            type="button"
            tabIndex={hidden ? -1 : 0}
            style={{ width: ACTION_WIDTH }}
            className={cn(
                'h-full text-sm font-medium',
                toneClass[action.tone ?? 'neutral'],
            )}
            onClick={() => {
                onDone();
                action.onAction();
            }}
        >
            {action.icon && (
                <action.icon
                    aria-hidden
                    className="mx-auto mb-1 size-5"
                    strokeWidth={1.75}
                />
            )}
            {action.label}
        </button>
    ));
}

/**
 * Row that reveals quick actions on a left swipe (and optional leading
 * actions on a right swipe, docs/PLATFORM.md §2). Actions stay reachable
 * without swiping through the row's own "more" menu.
 */
export function SwipeableRow({
    children,
    actions,
    leadingActions = [],
    className,
}: Props) {
    const maxOffset = actions.length * ACTION_WIDTH;
    const maxLeading = leadingActions.length * ACTION_WIDTH;
    const [offset, setOffset] = useState(0);
    const start = useRef<{ x: number; y: number; offset: number } | null>(null);
    const horizontal = useRef(false);

    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        start.current = { x: event.clientX, y: event.clientY, offset };
        horizontal.current = false;
    };

    const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
        if (!start.current) {
            return;
        }

        const dx = event.clientX - start.current.x;
        const dy = event.clientY - start.current.y;

        if (!horizontal.current) {
            if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) {
                return;
            }

            horizontal.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
        }

        const next = Math.min(
            maxLeading,
            Math.max(-maxOffset, start.current.offset + dx),
        );
        setOffset(next);
    };

    const onPointerUp = () => {
        if (horizontal.current) {
            setOffset(
                offset < -maxOffset / 2
                    ? -maxOffset
                    : maxLeading > 0 && offset > maxLeading / 2
                      ? maxLeading
                      : 0,
            );
        }

        start.current = null;
    };

    return (
        <div className={cn('relative overflow-hidden', className)}>
            {leadingActions.length > 0 && (
                <div
                    className={cn(
                        'absolute inset-y-0 left-0 flex',
                        offset <= 0 && 'invisible',
                    )}
                    aria-hidden={offset <= 0}
                >
                    <ActionButtons
                        actions={leadingActions}
                        hidden={offset <= 0}
                        onDone={() => setOffset(0)}
                    />
                </div>
            )}
            <div
                className={cn(
                    'absolute inset-y-0 right-0 flex',
                    // Hidden at rest so no seam shows through the row's rounded edge.
                    offset >= 0 && 'invisible',
                )}
                aria-hidden={offset >= 0}
            >
                <ActionButtons
                    actions={actions}
                    hidden={offset >= 0}
                    onDone={() => setOffset(0)}
                />
            </div>
            <div
                className="relative touch-pan-y bg-surface transition-transform duration-180 ease-brand"
                style={{ transform: `translateX(${offset}px)` }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
            >
                {children}
            </div>
        </div>
    );
}
