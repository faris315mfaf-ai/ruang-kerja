import type { InertiaLinkProps } from '@inertiajs/react';
import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge that knows the Arus utilities (app.css @theme): without this
 * it would read `text-label` as a colour and drop it next to `text-text`, or
 * merge `bg-grad-aksi` away against a `bg-*` colour.
 */
const twMerge = extendTailwindMerge({
    extend: {
        theme: {
            text: [
                'display',
                'h1',
                'h2',
                'h3',
                'title',
                'body-lg',
                'body',
                'label',
                'meta',
                'kpi',
                'overline',
            ],
            radius: ['control', 'card', 'panel', 'sheet'],
            shadow: [
                'card',
                'float',
                'glow',
                'button',
                'button-lg',
                'warm',
                'inverse',
                'knob',
                'segment',
            ],
            spacing: ['control-sm', 'control', 'control-lg', 'control-xl'],
        },
        classGroups: {
            'bg-image': [
                {
                    bg: [
                        'grad-aksi',
                        'grad-merek',
                        'grad-merek-x',
                        'grad-merek-y',
                        'grad-hangat',
                        'grad-indigo',
                        'grad-slate',
                        'grad-soft',
                        'grad-active',
                        'grad-highlight',
                        'page',
                    ],
                },
            ],
        },
    },
});

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function toUrl(url: NonNullable<InertiaLinkProps['href']>): string {
    return typeof url === 'string' ? url : url.url;
}

/** Keyboard focus of custom controls: 3px teal ring at 40% (Komponen "Fokus"). */
export const focusRing =
    'outline-none focus-visible:ring-[3px] focus-visible:ring-ring';
