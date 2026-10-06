import type { LucideIcon } from 'lucide-react';
import {
    AlarmClock,
    AtSign,
    Bell,
    CalendarClock,
    CheckCheck,
    CircleAlert,
    KeyRound,
    Megaphone,
    MessageSquare,
    Plus,
    RotateCcw,
    ShieldAlert,
    X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NotificationTone } from '@/types/notifications';

/** Keys returned by NotificationType::icon() on the server. */
const ICONS: Record<string, LucideIcon> = {
    plus: Plus,
    'at-sign': AtSign,
    message: MessageSquare,
    'calendar-clock': CalendarClock,
    alert: CircleAlert,
    'check-check': CheckCheck,
    x: X,
    rotate: RotateCcw,
    alarm: AlarmClock,
    megaphone: Megaphone,
    bell: Bell,
    shield: ShieldAlert,
    key: KeyRound,
};

export const toneClasses: Record<NotificationTone, string> = {
    primary: 'bg-link-soft text-link',
    info: 'bg-info-soft text-info',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
    neutral: 'bg-surface-2 text-text-muted',
};

export const toneText: Record<NotificationTone, string> = {
    primary: 'text-link',
    info: 'text-info',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    neutral: 'text-text-muted',
};

export function notificationIcon(key: string): LucideIcon {
    return ICONS[key] ?? Bell;
}

const SIZES = {
    /** Inbox rows (DInbox / MInbox): 44px tile, radius 14. */
    md: 'size-11 rounded-[14px] [&>svg]:size-[22px]',
    /** Notification centre / toast (MNotifCenter): 40px tile, radius 12. */
    sm: 'size-10 rounded-control [&>svg]:size-5',
} as const;

type Props = {
    icon: string;
    tone: NotificationTone;
    size?: keyof typeof SIZES;
    className?: string;
};

/** Tinted icon tile used in the Inbox, toast and detail pane. */
export function NotificationIcon({
    icon,
    tone,
    size = 'md',
    className,
}: Props) {
    const Icon = notificationIcon(icon);

    return (
        <span
            aria-hidden
            className={cn(
                'flex shrink-0 items-center justify-center',
                SIZES[size],
                toneClasses[tone] ?? toneClasses.neutral,
                className,
            )}
        >
            <Icon strokeWidth={1.9} />
        </span>
    );
}
