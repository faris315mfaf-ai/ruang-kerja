import type { BadgeTone } from '@/components/ui/badge';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { STATUS_LABELS } from './lib';
import type { DeviceStatus } from './types';

const TONES: Record<DeviceStatus, BadgeTone> = {
    online: 'success',
    offline: 'danger',
    pending: 'neutral',
};

export function DeviceStatusBadge({
    status,
    className,
}: {
    status: DeviceStatus;
    className?: string;
}) {
    return (
        <Badge
            variant="status"
            tone={TONES[status]}
            dot
            className={cn('h-7 text-[14px]', className)}
        >
            {STATUS_LABELS[status]}
        </Badge>
    );
}
