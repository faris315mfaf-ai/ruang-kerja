/** Tiptap/ProseMirror JSON as stored in tasks.description and comments.body. */
export type RichMark = {
    type: string;
    attrs?: Record<string, unknown>;
};

export type RichNode = {
    type: string;
    attrs?: Record<string, unknown>;
    content?: RichNode[];
    marks?: RichMark[];
    text?: string;
};

export type RichDoc = RichNode & { type: 'doc' };

/** "#KEY-n" reference resolved for the viewer (only visible tasks). */
export type TaskReferenceInfo = {
    key: string;
    title: string;
    status_category: string;
    url: string;
};

export type MentionSuggestion = {
    id: string;
    name: string;
    avatar: string | null;
};

export type TaskSuggestion = {
    id: string;
    key: string;
    title: string;
    status_category: string;
};
