import { Head } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { SearchLayout } from '@/features/search/search-layout';
import { SearchScreen } from '@/features/search/search-screen';
import type { SearchGroupInfo } from '@/features/search/types';

type Props = {
    q: string;
    groups: SearchGroupInfo[];
};

export default function SearchPage({ q, groups }: Props) {
    return (
        <>
            <Head title="Cari" />
            <SearchScreen initialQuery={q} groups={groups} />
        </>
    );
}

SearchPage.layout = (page: ReactNode) => <SearchLayout>{page}</SearchLayout>;
