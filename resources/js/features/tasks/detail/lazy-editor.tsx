import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import type { RichTextEditorProps } from '../editor/rich-text-editor';

const Editor = lazy(() => import('../editor/rich-text-editor'));

/** Tiptap is code-split: loaded the first time an editor is shown. */
export function LazyRichTextEditor(props: RichTextEditorProps) {
    return (
        <Suspense
            fallback={
                <div className="space-y-2 py-1" aria-busy>
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </div>
            }
        >
            <Editor {...props} />
        </Suspense>
    );
}
