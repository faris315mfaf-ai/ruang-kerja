import { Check } from 'lucide-react';
import { useState } from 'react';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { DriveFileIcon } from '@/features/drive/drive-file-icon';
import { cn, focusRing } from '@/lib/utils';
import type { MessageAttachment } from './types';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    files: MessageAttachment[];
    onPick: (files: MessageAttachment[]) => void;
    mobile?: boolean;
};

/**
 * Stand-in for Google Picker (scope drive.file): choose files from the
 * workspace Drive folder to attach to a message.
 */
export function DrivePicker({
    open,
    onOpenChange,
    files,
    onPick,
    mobile = false,
}: Props) {
    const [selected, setSelected] = useState<string[]>([]);

    const toggle = (id: string) =>
        setSelected((current) =>
            current.includes(id)
                ? current.filter((item) => item !== id)
                : [...current, id],
        );

    const confirm = () => {
        onPick(files.filter((file) => selected.includes(file.id)));
        setSelected([]);
        onOpenChange(false);
    };

    const list = (
        <ul aria-label="File Google Drive" className="flex flex-col gap-1.5">
            {files.map((file) => {
                const checked = selected.includes(file.id);

                return (
                    <li key={file.id}>
                        <button
                            type="button"
                            role="checkbox"
                            aria-checked={checked}
                            onClick={() => toggle(file.id)}
                            className={cn(
                                'flex min-h-14 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors duration-120 ease-brand',
                                checked
                                    ? 'border-primary bg-link-soft'
                                    : 'border-border bg-surface hover:bg-surface-2',
                                focusRing,
                            )}
                        >
                            <DriveFileIcon kind={file.kind} />
                            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-text">
                                {file.name}
                            </span>
                            <span
                                aria-hidden
                                className={cn(
                                    'flex size-6 shrink-0 items-center justify-center rounded-[7px] border',
                                    checked
                                        ? 'border-transparent bg-grad-aksi text-on-brand'
                                        : 'border-border-strong',
                                )}
                            >
                                {checked && (
                                    <Check className="size-4" strokeWidth={3} />
                                )}
                            </span>
                        </button>
                    </li>
                );
            })}
        </ul>
    );

    const action = (
        <Button
            onClick={confirm}
            disabled={selected.length === 0}
            size={mobile ? 'lg' : 'default'}
            className={cn(mobile && 'w-full')}
        >
            Lampirkan
            {selected.length > 0 && ` (${selected.length})`}
        </Button>
    );

    if (mobile) {
        return (
            <BottomSheet
                open={open}
                onOpenChange={onOpenChange}
                title="Lampirkan dari Drive"
                description="Folder Drive workspace ini"
                footer={action}
            >
                {list}
            </BottomSheet>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Lampirkan dari Drive</DialogTitle>
                    <DialogDescription>
                        Pilih file dari folder Drive workspace. Anggota channel
                        mendapat akses baca.
                    </DialogDescription>
                </DialogHeader>
                {list}
                <DialogFooter>
                    <Button variant="quiet" onClick={() => onOpenChange(false)}>
                        Batal
                    </Button>
                    {action}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
