import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn (Arus tailwind-merge)', () => {
    it('keeps type-scale sizes next to text colours', () => {
        expect(cn('text-label', 'text-text-muted')).toBe(
            'text-label text-text-muted',
        );
        expect(cn('text-meta', 'text-body')).toBe('text-body');
    });

    it('treats gradients as background images, not colours', () => {
        expect(cn('bg-primary bg-grad-aksi')).toBe('bg-primary bg-grad-aksi');
        expect(cn('bg-grad-aksi', 'bg-grad-hangat')).toBe('bg-grad-hangat');
    });

    it('merges Arus radius, shadow and control heights', () => {
        expect(cn('rounded-md', 'rounded-card')).toBe('rounded-card');
        expect(cn('shadow-card', 'shadow-float')).toBe('shadow-float');
        expect(cn('h-11', 'h-control-lg')).toBe('h-control-lg');
    });
});
