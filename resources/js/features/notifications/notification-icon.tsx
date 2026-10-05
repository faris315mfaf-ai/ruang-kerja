import type { LucideIcon } from 'lucide-react';
import {
    AlarmClock,
    AtSign,
    Bell,
    CalendarClock,
    CheckCheck,
    CircleAlert,
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
};

export const toneClasses: Record<NotificationTone, string> = {
    primary: 'bg-link-soft text-primary',
    info: 'bg-info-soft text-info',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
    neutral: 'bg-surface-2 text-text-muted',
};

export const toneText: Record<NotificationTone, string> = {
    primary: 'text-primary',
    info: 'text-info',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    neutral: 'text-text-muted',
};

export function notificationIcon(key: string): LucideIcon {
    return ICONS[key] ?? Bell;
}

type Props = {
    icon: string;
    tone: NotificationTone;
    className?: string;
};

/** Round tinted icon used in the Inbox, toast and detail pane. */
export function NotificationIcon({ icon, tone, className }: Props) {
    const Icon = notificationIcon(icon);

    return (
        <span
            aria-hidden
            className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full',
                toneClasses[tone] ?? toneClasses.neutral,
                className,
            )}
        >
            <Icon className="size-4" strokeWidth={1.75} />
        </span>
    );
}
