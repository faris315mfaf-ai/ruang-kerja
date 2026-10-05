import type { LucideIcon } from 'lucide-react';
import { Bell, Mail, MessageCircle } from 'lucide-react';
import type { ChannelKey } from '@/features/notifications/settings/types';

export const CHANNEL_ICONS: Record<ChannelKey, LucideIcon> = {
    in_app: Bell,
    email: Mail,
    whatsapp: MessageCircle,
};
