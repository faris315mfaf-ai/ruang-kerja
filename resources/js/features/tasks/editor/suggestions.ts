import type { Editor } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { ReactRenderer } from '@tiptap/react';
import type {
    SuggestionKeyDownProps,
    SuggestionOptions,
    SuggestionProps,
} from '@tiptap/suggestion';
import { requestJson } from '@/lib/http';
import { references } from '@/routes/workspaces';
import type { SuggestionItem, SuggestionListHandle } from './suggestion-list';
import { SuggestionList } from './suggestion-list';
import type { MentionSuggestion, TaskSuggestion } from './types';

export const MentionPluginKey = new PluginKey('mention');
export const TaskReferencePluginKey = new PluginKey('taskReference');

type Kind = 'person' | 'task';

/** GET /w/{key}/rujukan?type=people|tasks&q= (server filters by access). */
export async function fetchSuggestions(
    workspaceKey: string,
    kind: Kind,
    query: string,
): Promise<SuggestionItem[]> {
    const url = references.url(workspaceKey, {
        query: { type: kind === 'person' ? 'people' : 'tasks', q: query },
    });

    if (kind === 'person') {
        const data = await requestJson<{ people: MentionSuggestion[] }>(url);

        return data.people.map((person) => ({ kind: 'person', ...person }));
    }

    const data = await requestJson<{ tasks: TaskSuggestion[] }>(url);

    return data.tasks.map((task) => ({ kind: 'task', ...task }));
}

type ListProps = {
    items: SuggestionItem[];
    loading: boolean;
    kind: Kind;
    command: (item: SuggestionItem) => void;
};

function place(element: HTMLElement, rect: DOMRect | null | undefined): void {
    if (!rect) {
        return;
    }

    const below = rect.bottom + 6;
    const fitsBelow = below + 300 < window.innerHeight;
    element.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 296))}px`;
    element.style.top = fitsBelow ? `${below}px` : '';
    element.style.bottom = fitsBelow
        ? ''
        : `${window.innerHeight - rect.top + 6}px`;
}

/**
 * Suggestion options for one trigger ("@" or "#"). The popup is a fixed,
 * glass list rendered next to the caret; results come from the server.
 */
export function suggestionOptions(
    workspaceKey: string,
    kind: Kind,
): Omit<SuggestionOptions<SuggestionItem>, 'editor'> {
    return {
        char: kind === 'person' ? '@' : '#',
        pluginKey:
            kind === 'person' ? MentionPluginKey : TaskReferencePluginKey,
        allowSpaces: kind === 'person',
        items: async ({ query }) => {
            try {
                return await fetchSuggestions(workspaceKey, kind, query);
            } catch {
                return [];
            }
        },
        command: ({ editor, range, props }) => {
            const item = props as unknown as SuggestionItem;
            insertReference(editor, range, item);
        },
        render: () => {
            let renderer: ReactRenderer<
                SuggestionListHandle,
                ListProps
            > | null = null;
            let container: HTMLElement | null = null;

            const propsFor = (
                props: SuggestionProps<SuggestionItem>,
                loading: boolean,
            ): ListProps => ({
                items: props.items,
                loading,
                kind,
                command: (item) =>
                    props.command(item as unknown as SuggestionItem),
            });

            return {
                onBeforeStart: (props) => {
                    container = document.createElement('div');
                    container.style.position = 'fixed';
                    container.style.zIndex = '80';
                    document.body.appendChild(container);
                    renderer = new ReactRenderer(SuggestionList, {
                        props: propsFor(props, true),
                        editor: props.editor,
                    });
                    container.appendChild(renderer.element);
                    place(container, props.clientRect?.());
                },
                onStart: (props) => {
                    renderer?.updateProps(propsFor(props, false));
                    if (container) {
                        place(container, props.clientRect?.());
                    }
                },
                onUpdate: (props) => {
                    renderer?.updateProps(propsFor(props, false));
                    if (container) {
                        place(container, props.clientRect?.());
                    }
                },
                onKeyDown: (props: SuggestionKeyDownProps) => {
                    if (props.event.key === 'Escape') {
                        container?.remove();

                        return true;
                    }

                    return renderer?.ref?.onKeyDown(props.event) ?? false;
                },
                onExit: () => {
                    renderer?.destroy();
                    container?.remove();
                    renderer = null;
                    container = null;
                },
            };
        },
    };
}

function insertReference(
    editor: Editor,
    range: { from: number; to: number },
    item: SuggestionItem,
): void {
    const node =
        item.kind === 'person'
            ? { type: 'mention', attrs: { id: item.id, label: item.name } }
            : {
                  type: 'taskReference',
                  attrs: { id: item.id, label: item.key },
              };

    editor
        .chain()
        .focus()
        .insertContentAt(range, [node, { type: 'text', text: ' ' }])
        .run();
}
