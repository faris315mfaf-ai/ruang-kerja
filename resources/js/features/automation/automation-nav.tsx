import { usePage } from '@inertiajs/react';
import { TabNav } from '@/components/ui/tabs';

const LINKS = [
    { href: '/otomasi', label: 'Aturan' },
    { href: '/otomasi/berulang', label: 'Tugas berulang' },
    { href: '/otomasi/template', label: 'Template' },
] as const;

/** Section tabs shared by the three Otomasi screens. */
export function AutomationNav() {
    const path = usePage().url.split('?')[0];

    return (
        <TabNav
            label="Otomasi"
            className="-mx-4 px-4 md:mx-0 md:px-0"
            items={LINKS.map((link) => ({
                href: link.href,
                label: link.label,
                active: path === link.href,
            }))}
        />
    );
}
