import {
    File,
    FileImage,
    FileSpreadsheet,
    FileText,
    FileType,
    Folder,
    Presentation,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DriveFileKind } from './types';

const KINDS: Record<DriveFileKind, { icon: LucideIcon; tone: string }> = {
    doc: { icon: FileText, tone: 'bg-info/10 text-info' },
    sheet: { icon: FileSpreadsheet, tone: 'bg-success/10 text-success' },
    slide: { icon: Presentation, tone: 'bg-warning/10 text-warning' },
    pdf: { icon: FileType, tone: 'bg-danger/10 text-danger' },
    image: { icon: FileImage, tone: 'bg-primary/10 text-primary' },
    folder: { icon: Folder, tone: 'bg-surface-2 text-text-muted' },
    other: { icon: File, tone: 'bg-surface-2 text-text-muted' },
};

const SIZES = {
    sm: 'size-7 [&_svg]:size-4',
    md: 'size-9 [&_svg]:size-5',
    lg: 'size-11 [&_svg]:size-6',
};

type Props = {
    kind: DriveFileKind;
    size?: keyof typeof SIZES;
    className?: string;
};

/** Square file-type badge (Docs blue, Sheets green, Slides yellow, PDF red). */
export function DriveFileIcon({ kind, size = 'md', className }: Props) {
    const { icon: Icon, tone } = KINDS[kind];

    return (
        <span
            aria-hidden
            className={cn(
                'inline-flex shrink-0 items-center justify-center rounded-md',
                SIZES[size],
                tone,
                className,
            )}
        >
            <Icon strokeWidth={1.75} />
        </span>
    );
}
