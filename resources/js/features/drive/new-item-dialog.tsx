import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
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
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { DriveFileIcon } from './drive-file-icon';
import { newItemOption } from './new-item-options';
import type { NewItemType } from './new-item-options';

type Props = {
    type: NewItemType | null;
    /** "Disimpan di Shared Drive › Proyek Peluncuran Q4". */
    location: string;
    busy: boolean;
    onCancel: () => void;
    onSubmit: (type: NewItemType, name: string) => void;
};

/** Asks for the name of a new Docs/Sheets/Slides file or folder. */
export function NewItemDialog({
    type,
    location,
    busy,
    onCancel,
    onSubmit,
}: Props) {
    const mobile = useBreakpoint() === 'mobile';
    const id = useId();
    const [name, setName] = useState('');
    const option = type ? newItemOption(type) : null;

    useEffect(() => {
        if (type) {
            setName('');
        }
    }, [type]);

    const submit = (event: FormEvent) => {
        event.preventDefault();

        if (type && (type !== 'folder' || name.trim() !== '')) {
            onSubmit(type, name.trim());
        }
    };

    const title = option
        ? option.type === 'folder'
            ? 'Folder baru'
            : `${option.label} baru`
        : '';
    const form = option && (
        <form id={id} onSubmit={submit} className="space-y-2">
            <label
                htmlFor={`${id}-name`}
                className="flex items-center gap-2 text-[13px] font-medium text-text"
            >
                <DriveFileIcon kind={option.kind} size="sm" />
                Nama
            </label>
            <Input
                id={`${id}-name`}
                autoFocus
                value={name}
                maxLength={250}
                required={option.type === 'folder'}
                placeholder={option.placeholder}
                onChange={(event) => setName(event.target.value)}
                className="h-11 text-base md:h-9 md:text-sm"
            />
            <p className="text-[12px] text-text-muted">
                {option.type === 'folder'
                    ? 'Akses folder mengikuti anggota workspace.'
                    : 'Dokumen dibuka di tab baru setelah dibuat.'}
            </p>
        </form>
    );
    const actions = (
        <>
            <Button
                type="button"
                variant="outline"
                className="h-11 md:h-9"
                onClick={onCancel}
                disabled={busy}
            >
                Batal
            </Button>
            <Button
                type="submit"
                form={id}
                className="h-11 md:h-9"
                disabled={
                    busy || (option?.type === 'folder' && name.trim() === '')
                }
            >
                {busy && <Spinner />}
                {option?.type === 'folder' ? 'Buat folder' : 'Buat & buka'}
            </Button>
        </>
    );

    if (mobile) {
        return (
            <BottomSheet
                open={type !== null}
                onOpenChange={(open) => !open && !busy && onCancel()}
                title={title}
                description={location}
                footer={<div className="grid grid-cols-2 gap-2">{actions}</div>}
            >
                {form}
            </BottomSheet>
        );
    }

    return (
        <Dialog
            open={type !== null}
            onOpenChange={(open) => !open && !busy && onCancel()}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{location}</DialogDescription>
                </DialogHeader>
                {form}
                <DialogFooter>{actions}</DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
