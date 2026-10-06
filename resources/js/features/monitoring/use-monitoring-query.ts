import { router } from '@inertiajs/react';
import { useState } from 'react';

type Query = { tanggal: string; minggu: string };

/**
 * Date (`?tanggal=`) and week (`?minggu=`) of the Direksi dashboard live in
 * the URL; changing one reloads only the affected deferred block.
 */
export function useMonitoringQuery(monitoring: {
    date: string;
    week: string;
    today: string;
}) {
    const [loading, setLoading] = useState<'daily' | 'weekly' | null>(null);
    const current: Query = {
        tanggal: monitoring.date,
        minggu: monitoring.week,
    };

    const visit = (changes: Partial<Query>, block: 'daily' | 'weekly') => {
        const query: Record<string, string> = { ...current, ...changes };

        if (query.tanggal === monitoring.today) {
            delete query.tanggal;
        }

        router.get(window.location.pathname, query, {
            only:
                block === 'daily'
                    ? ['daily', 'monitoring']
                    : ['weekly', 'projects', 'monitoring'],
            preserveState: true,
            preserveScroll: true,
            replace: true,
            onStart: () => setLoading(block),
            onFinish: () => setLoading(null),
        });
    };

    return {
        loading,
        setDate: (date: string) => visit({ tanggal: date }, 'daily'),
        setWeek: (week: string) => visit({ minggu: week }, 'weekly'),
    };
}
