import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { StatusIcon } from '@/components/status-icon';
import { isPaletteColor } from '@/lib/palette';
import { cn } from '@/lib/utils';
import type { StatusCategory } from '../types';
import type { RichMark, RichNode, TaskReferenceInfo } from './types';

type Props = {
    doc: RichNode | null;
    references?: Record<string, TaskReferenceInfo>;
    className?: string;
    /** Shown when the document is empty. */
    empty?: ReactNode;
};

const SAFE_HREF = /^(https?:|mailto:)/i;

function attr(node: RichNode | RichMark, key: string): unknown {
    return node.attrs?.[key];
}

function textAttr(node: RichNode, key: string): string {
    const value = attr(node, key);

    return typeof value === 'string' || typeof value === 'number'
        ? String(value)
        : '';
}

function withMarks(text: ReactNode, marks: RichMark[] = [], key: string) {
    return marks.reduce<ReactNode>((child, mark, index) => {
        const k = `${key}-m${index}`;

        switch (mark.type) {
            case 'bold':
                return <strong key={k}>{child}</strong>;
            case 'italic':
                return <em key={k}>{child}</em>;
            case 'strike':
                return <s key={k}>{child}</s>;
            case 'underline':
                return <u key={k}>{child}</u>;
            case 'code':
                return <code key={k}>{child}</code>;
            // Notes only (palette name; colours in rich-text.css).
            case 'textColor': {
                const color = attr(mark, 'color');

                return isPaletteColor(color) ? (
                    <span key={k} className="rk-color" data-color={color}>
                        {child}
                    </span>
                ) : (
                    child
                );
            }
            case 'highlight': {
                const color = attr(mark, 'color');

                return isPaletteColor(color) ? (
                    <mark key={k} className="rk-highlight" data-color={color}>
                        {child}
                    </mark>
                ) : (
                    child
                );
            }
            case 'link': {
                const href = attr(mark, 'href');

                return typeof href === 'string' && SAFE_HREF.test(href) ? (
                    <a
                        key={k}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                    >
                        {child}
                    </a>
                ) : (
                    child
                );
            }
            default:
                return child;
        }
    }, text);
}

function renderNodes(
    nodes: RichNode[] | undefined,
    references: Record<string, TaskReferenceInfo>,
    prefix: string,
): ReactNode[] {
    return (nodes ?? []).map((node, index) =>
        renderNode(node, references, `${prefix}-${index}`),
    );
}

function renderNode(
    node: RichNode,
    references: Record<string, TaskReferenceInfo>,
    key: string,
): ReactNode {
    const children = () => renderNodes(node.content, references, key);

    switch (node.type) {
        case 'doc':
            return <>{children()}</>;
        case 'text':
            return withMarks(node.text ?? '', node.marks, key);
        case 'paragraph':
            return <p key={key}>{children()}</p>;
        case 'heading': {
            const level = Number(attr(node, 'level') ?? 2);

            return level <= 1 ? (
                <h3 key={key}>{children()}</h3>
            ) : level === 2 ? (
                <h4 key={key}>{children()}</h4>
            ) : (
                <h5 key={key}>{children()}</h5>
            );
        }
        case 'bulletList':
            return <ul key={key}>{children()}</ul>;
        case 'orderedList': {
            const start = Number(attr(node, 'start') ?? 1);

            return (
                <ol key={key} start={start > 1 ? start : undefined}>
                    {children()}
                </ol>
            );
        }
        case 'listItem':
            return <li key={key}>{children()}</li>;
        case 'taskList':
            return (
                <ul key={key} data-type="taskList">
                    {children()}
                </ul>
            );
        case 'taskItem': {
            const checked = attr(node, 'checked') === true;

            return (
                <li key={key} data-checked={checked}>
                    <span
                        aria-hidden
                        className={cn(
                            'rt-check',
                            checked && 'bg-primary text-primary-foreground',
                        )}
                    >
                        {checked ? '✓' : ''}
                    </span>
                    <span className="sr-only">
                        {checked ? 'Selesai: ' : 'Belum: '}
                    </span>
                    <div>{children()}</div>
                </li>
            );
        }
        case 'blockquote':
            return <blockquote key={key}>{children()}</blockquote>;
        case 'codeBlock':
            return (
                <pre key={key}>
                    <code>{children()}</code>
                </pre>
            );
        case 'hardBreak':
            return <br key={key} />;
        case 'horizontalRule':
            return <hr key={key} />;
        case 'mention':
            return (
                <span key={key} className="rt-mention">
                    @{textAttr(node, 'label')}
                </span>
            );
        case 'taskReference': {
            const id = textAttr(node, 'id');
            const info = references[id];

            if (!info) {
                return <span key={key}>#{textAttr(node, 'label')}</span>;
            }

            return (
                <Link
                    key={key}
                    href={info.url}
                    className="rt-task-ref"
                    title={info.title}
                >
                    <StatusIcon
                        category={info.status_category as StatusCategory}
                        className="size-3"
                    />
                    {info.key}
                </Link>
            );
        }
        default:
            return null;
    }
}

/**
 * Read-only rendering of a Tiptap document as React elements (no HTML
 * strings, no editor instance per comment). #references link only to tasks
 * the viewer can see; others stay plain text.
 */
export function RichTextView({
    doc,
    references = {},
    className,
    empty = null,
}: Props) {
    if (!doc || !doc.content || doc.content.length === 0) {
        return <>{empty}</>;
    }

    return (
        <div className={cn('rich-text text-body text-text', className)}>
            {renderNode(doc, references, 'n')}
        </div>
    );
}
