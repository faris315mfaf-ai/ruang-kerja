/** One allowlisted repository document (config/docs.php). */
export type DocListItem = {
    slug: string;
    title: string;
    /** Group key, see DocGroup. */
    group: string;
    /** Path in the repository, e.g. docs/PRD.md. */
    path: string;
    size: number;
    /** ISO 8601 (UTC) file modification time. */
    updatedAt: string;
};

export type DocGroup = { key: string; label: string };

export type DocTocItem = { id: string; text: string; level: number };

export type DocDetail = DocListItem & {
    /** Server-rendered Markdown (raw HTML escaped, links rewritten). */
    html: string;
    toc: DocTocItem[];
};
