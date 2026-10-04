import type { PointerEvent, ReactNode } from 'react';
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export type SwipeAction = {
    label: string;
    onAction: () => void;
    tone?: 'primary' | 'danger' | 'neutral';
};

type Props = {
    children: ReactNode;
    /** Revealed when swiping left (right edge). */
    actions: SwipeAction[];
    className?: string;
};

const ACTION_WIDTH = 80;

const toneClass: Record<NonNullable<SwipeAction['tone']>, string> = {
    primary: 'bg-primary text-primary-foreground',
    danger: 'bg-danger text-on-danger',
    neutral: 'bg-surface-2 text-text',
};

/**
 * Row that reveals quick actions on a left swipe (docs/PLATFORM.md §2).
 * Actions stay reachable without swiping through the row's own "more" menu.
 */
export function SwipeableRow({ children, actions, className }: Props) {
    const maxOffset = actions.length * ACTION_WIDTH;
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
            0,
            Math.max(-maxOffset, start.current.offset + dx),
        );
        setOffset(next);
    };

    const onPointerUp = () => {
        if (horizontal.current) {
            setOffset(offset < -maxOffset / 2 ? -maxOffset : 0);
        }

        start.current = null;
    };

    return (
        <div className={cn('relative overflow-hidden', className)}>
            <div
                className="absolute inset-y-0 right-0 flex"
                aria-hidden={offset === 0}
            >
                {actions.map((action) => (
                    <button
                        key={action.label}
                        type="button"
                        tabIndex={offset === 0 ? -1 : 0}
                        style={{ width: ACTION_WIDTH }}
                        className={cn(
                            'h-full text-sm font-medium',
                            toneClass[action.tone ?? 'neutral'],
                        )}
                        onClick={() => {
                            setOffset(0);
                            action.onAction();
                        }}
                    >
                        {action.label}
                    </button>
                ))}
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
