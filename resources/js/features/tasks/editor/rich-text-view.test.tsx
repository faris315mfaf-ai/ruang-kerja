import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

vi.mock('@inertiajs/react', () => ({
    Link: ({ children, href }: { children: ReactNode; href: string }) => (
        <a href={href}>{children}</a>
    ),
}));

import { RichTextView } from './rich-text-view';
import type { RichDoc } from './types';

describe('RichTextView colour marks (notes)', () => {
    afterEach(cleanup);

    it('renders palette text colour and highlight, never a raw CSS value', () => {
        const doc: RichDoc = {
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    content: [
                        {
                            type: 'text',
                            text: 'Keputusan',
                            marks: [
                                { type: 'textColor', attrs: { color: 'red' } },
                                {
                                    type: 'highlight',
                                    attrs: { color: 'amber' },
                                },
                            ],
                        },
                        {
                            type: 'text',
                            text: ' jahat',
                            marks: [
                                {
                                    type: 'textColor',
                                    attrs: { color: 'url(x)' },
                                },
                            ],
                        },
                    ],
                },
            ],
        };

        const { container } = render(<RichTextView doc={doc} />);

        const color = container.querySelector('span.rk-color');
        const mark = container.querySelector('mark.rk-highlight');

        expect(color?.getAttribute('data-color')).toBe('red');
        expect(mark?.getAttribute('data-color')).toBe('amber');
        expect(mark?.textContent).toBe('Keputusan');
        expect(container.querySelectorAll('[data-color]')).toHaveLength(2);
        expect(container.textContent).toContain('jahat');
        expect(container.innerHTML).not.toContain('url(x)');
    });
});
