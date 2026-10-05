import type { BalanceCard, RequestDetail, RequestItem } from '@/types/requests';

export type RequestFilter = 'semua' | 'menunggu' | 'disetujui' | 'ditolak';

export const FILTERS: { value: RequestFilter; label: string }[] = [
    { value: 'semua', label: 'Semua' },
    { value: 'menunggu', label: 'Menunggu' },
    { value: 'disetujui', label: 'Disetujui' },
    { value: 'ditolak', label: 'Ditolak' },
];

export type MyRequestsProps = {
    filter: RequestFilter;
    counts: Record<RequestFilter, number>;
    requests: RequestItem[];
    selected: RequestDetail | null;
    balances: BalanceCard[];
    since: string | null;
};
