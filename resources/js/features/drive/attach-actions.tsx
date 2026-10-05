import { Camera, FolderOpen, HardDrive, Upload } from 'lucide-react';
import { useRef } from 'react';
import type { ReactNode } from 'react';
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
import {
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { DriveFileIcon } from './drive-file-icon';
import { NEW_ITEM_OPTIONS } from './new-item-options';
import type { NewItemType } from './new-item-options';
import type { PickedDriveFile } from './types';
import type { DrivePickerState } from './use-drive-picker';
import { useDrivePicker } from './use-drive-picker';

/** Docs / Sheets / Slides (no folders for attachments). */
export const DOCUMENT_OPTIONS = NEW_ITEM_OPTIONS.filter(
    (option) => option.type !== 'folder',
);

export type AttachHandlers = {
    onFiles: (files: File[]) => void;
    onPicked: (files: PickedDriveFile[]) => void;
    onNewDocument: (type: NewItemType) => void;
};

/**
 * The three ways to attach a Drive file — "Unggah" (also the camera on
 * phones), "Pilih dari Drive" (Google Picker) and "Dokumen baru" — shared
 * by the attachments panel and the comment composer. Render `elements`
 * once (hidden inputs + "Hubungkan akun Google" prompt).
 */
export function useAttachActions({
    onFiles,
    onPicked,
    onNewDocument,
}: AttachHandlers) {
    const upload = useRef<HTMLInputElement>(null);
    const camera = useRef<HTMLInputElement>(null);
    const picker = useDrivePicker({ onPicked });

    const take = (input: HTMLInputElement) => {
        const files = Array.from(input.files ?? []);
        input.value = '';

        if (files.length > 0) {
            onFiles(files);
        }
    };

    const elements = (
        <>
            <input
                ref={upload}
                type="file"
                multiple
                hidden
                data-testid="attach-upload-input"
                onChange={(event) => take(event.target)}
            />
            <input
                ref={camera}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(event) => take(event.target)}
            />
            <DriveConnectPrompt
                state={picker.state}
                onDismiss={picker.dismiss}
            />
        </>
    );

    return {
        chooseFiles: () => upload.current?.click(),
        takePhoto: () => camera.current?.click(),
        openPicker: () => void picker.open(),
        pickerLoading: picker.state.status === 'loading',
        newDocument: onNewDocument,
        elements,
    };
}

export type AttachActions = ReturnType<typeof useAttachActions>;

/**
 * "Hubungkan akun Google" before Google Picker can open: dialog on desktop,
 * bottom sheet on phones.
 */
export function DriveConnectPrompt({
    state,
    onDismiss,
}: {
    state: DrivePickerState;
    onDismiss: () => void;
}) {
    const mobile = useBreakpoint() === 'mobile';

    if (state.status !== 'needs_connect') {
        return null;
    }

    const explanation =
        'RuangKerja hanya dapat membuka file yang Anda pilih sendiri di Google Picker. Anda akan diarahkan ke Google, lalu kembali ke halaman ini.';

    if (mobile) {
        return (
            <BottomSheet
                open
                onOpenChange={(open) => !open && onDismiss()}
                title="Hubungkan akun Google"
                description={state.message}
                footer={
                    <a
                        href={state.connectUrl}
                        className="flex h-12 w-full items-center justify-center rounded-md bg-primary text-[16px] font-medium text-primary-foreground"
                    >
                        Hubungkan akun Google
                    </a>
                }
            >
                <p className="text-[15px] text-text-muted">{explanation}</p>
            </BottomSheet>
        );
    }

    return (
        <Dialog open onOpenChange={(open) => !open && onDismiss()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Hubungkan akun Google</DialogTitle>
                    <DialogDescription>{state.message}</DialogDescription>
                </DialogHeader>
                <p className="text-sm text-text-muted">{explanation}</p>
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        className="h-11 md:h-9"
                        onClick={onDismiss}
                    >
                        Batal
                    </Button>
                    <Button asChild className="h-11 md:h-9">
                        <a href={state.connectUrl}>Hubungkan akun Google</a>
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Dropdown items "Unggah file / Pilih dari Drive / Docs·Sheets·Slides baru". */
export function AttachMenuItems({ actions }: { actions: AttachActions }) {
    return (
        <>
            <DropdownMenuItem onSelect={actions.chooseFiles}>
                <Upload aria-hidden />
                Unggah file
            </DropdownMenuItem>
            <DropdownMenuItem
                disabled={actions.pickerLoading}
                onSelect={actions.openPicker}
            >
                <FolderOpen aria-hidden />
                Pilih dari Drive
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-text-muted">
                Dokumen baru
            </DropdownMenuLabel>
            {DOCUMENT_OPTIONS.map((option) => (
                <DropdownMenuItem
                    key={option.type}
                    className="gap-3"
                    onSelect={() => actions.newDocument(option.type)}
                >
                    <DriveFileIcon kind={option.kind} size="sm" />
                    {option.label}
                </DropdownMenuItem>
            ))}
        </>
    );
}

/** Mobile "Lampirkan" sheet (mockup MTaskDetail, sheet MFile). */
export function AttachSheet({
    open,
    onOpenChange,
    title = 'Lampirkan file',
    actions,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title?: string;
    actions: AttachActions;
}) {
    // Close first, then act: the file chooser / Picker opens above the page.
    const choose = (action: () => void) => {
        onOpenChange(false);
        window.setTimeout(action, 0);
    };

    return (
        <BottomSheet
            open={open}
            onOpenChange={onOpenChange}
            title={title}
            description="Disimpan di folder Google Drive workspace."
        >
            <ul className="space-y-1">
                <li>
                    <SheetAction
                        icon={
                            <ActionIcon>
                                <Camera />
                            </ActionIcon>
                        }
                        title="Ambil foto"
                        description="Nota, kuitansi, papan tulis"
                        onClick={() => choose(actions.takePhoto)}
                    />
                </li>
                <li>
                    <SheetAction
                        icon={
                            <ActionIcon>
                                <Upload />
                            </ActionIcon>
                        }
                        title="Unggah dari ponsel"
                        description="Foto, PDF, atau dokumen lain"
                        onClick={() => choose(actions.chooseFiles)}
                    />
                </li>
                <li>
                    <SheetAction
                        icon={
                            <ActionIcon>
                                <HardDrive />
                            </ActionIcon>
                        }
                        title="Pilih dari Drive"
                        description="Tautkan file yang sudah ada"
                        onClick={() => choose(actions.openPicker)}
                    />
                </li>
                {DOCUMENT_OPTIONS.map((option) => (
                    <li key={option.type}>
                        <SheetAction
                            icon={
                                <DriveFileIcon kind={option.kind} size="lg" />
                            }
                            title={option.mobileLabel}
                            description={option.description}
                            onClick={() =>
                                choose(() => actions.newDocument(option.type))
                            }
                        />
                    </li>
                ))}
            </ul>
        </BottomSheet>
    );
}

function ActionIcon({ children }: { children: ReactNode }) {
    return (
        <span
            aria-hidden
            className="flex size-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary [&_svg]:size-5"
        >
            {children}
        </span>
    );
}

function SheetAction({
    icon,
    title,
    description,
    onClick,
}: {
    icon: ReactNode;
    title: string;
    description: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex min-h-16 w-full items-center gap-4 rounded-lg px-1 py-2 text-left active:bg-surface-2"
        >
            {icon}
            <span className="min-w-0">
                <span className="block text-[17px] text-text">{title}</span>
                <span className="block text-[14px] text-text-muted">
                    {description}
                </span>
            </span>
        </button>
    );
}
