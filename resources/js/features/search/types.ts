/** Mirrors App\Domain\Search\Data\SearchResult / RunSearch. */
export type SearchResult = {
    id: string;
    title: string;
    icon: string;
    url: string | null;
    action: string | null;
    code: string | null;
    subtitle: string | null;
    meta: string | null;
    shortcut: string | null;
    snippet: string | null;
    avatar: string | null;
    external: boolean;
};

export type SearchGroup = {
    key: string;
    label: string;
    items: SearchResult[];
};

export type SearchGroupInfo = { key: string; label: string };
