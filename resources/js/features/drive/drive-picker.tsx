import { FolderOpen } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import type { PickedDriveFile } from './types';
import { useDrivePicker } from './use-drive-picker';

type Props = {
    /** Receives the picked files; post their ids to the server to attach them. */
    onPicked: (files: PickedDriveFile[]) => void;
    multiple?: boolean;
    label?: string;
    variant?: ComponentProps<typeof Button>['variant'];
    size?: ComponentProps<typeof Button>['size'];
    disabled?: boolean;
    className?: string;
};

/**
 * "Pilih dari Drive" button: opens Google Picker with the user's own token
 * (scope drive.file). Asks the user to connect Google first when needed and
 * explains when the admin has not configured the Picker.
 */
export function DrivePicker({
    onPicked,
    multiple = true,
    label = 'Pilih dari Drive',
    variant = 'outline',
    size = 'sm',
    disabled = false,
    className,
}: Props) {
    const { state, open, dismiss } = useDrivePicker({ onPicked, multiple });
    const loading = state.status === 'loading';

    return (
        <>
            <Button
                type="button"
                variant={variant}
                size={size}
                disabled={disabled || loading}
                aria-busy={loading}
                className={cn('min-h-11 md:min-h-0', className)}
                onClick={() => void open()}
            >
                {loading ? <Spinner /> : <FolderOpen />}
                {label}
            </Button>

            <Dialog
                open={state.status === 'needs_connect'}
                onOpenChange={(isOpen) => !isOpen && dismiss()}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Hubungkan akun Google</DialogTitle>
                        <DialogDescription>
                            {state.status === 'needs_connect'
                                ? state.message
                                : null}
                        </DialogDescription>
                    </DialogHeader>
                    <p className="text-sm text-text-muted">
                        RuangKerja hanya dapat membuka file yang Anda pilih
                        sendiri di Google Picker. Anda akan diarahkan ke Google,
                        lalu kembali ke halaman ini.
                    </p>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            className="h-11 md:h-9"
                            onClick={dismiss}
                        >
                            Batal
                        </Button>
                        {state.status === 'needs_connect' && (
                            <Button asChild className="h-11 md:h-9">
                                <a href={state.connectUrl}>
                                    Hubungkan akun Google
                                </a>
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
