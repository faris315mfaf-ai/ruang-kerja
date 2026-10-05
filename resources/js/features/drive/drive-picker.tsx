import { FolderOpen } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { DriveConnectPrompt } from './attach-actions';
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

            <DriveConnectPrompt state={state} onDismiss={dismiss} />
        </>
    );
}
