import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { SHORTCUTS } from './keys';

/** "?" — list of keyboard shortcuts. */
export function ShortcutHelpDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-surface sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Pintasan keyboard</DialogTitle>
                    <DialogDescription>
                        Berlaku di board dan list saat tidak sedang mengetik.
                    </DialogDescription>
                </DialogHeader>
                <dl className="divide-y divide-border">
                    {SHORTCUTS.map((shortcut) => (
                        <div
                            key={shortcut.label}
                            className="flex items-center justify-between py-2 text-[13px]"
                        >
                            <dt className="text-text">{shortcut.label}</dt>
                            <dd className="flex gap-1">
                                {shortcut.keys.map((k) => (
                                    <kbd
                                        key={k}
                                        className="min-w-6 rounded border border-border bg-surface-2 px-1.5 py-0.5 text-center font-mono text-[11px] text-text-muted"
                                    >
                                        {k}
                                    </kbd>
                                ))}
                            </dd>
                        </div>
                    ))}
                </dl>
            </DialogContent>
        </Dialog>
    );
}
