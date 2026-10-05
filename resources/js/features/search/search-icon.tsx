import type { LucideIcon } from 'lucide-react';
import {
    Bell,
    Calendar,
    CheckCheck,
    Circle,
    CircleCheck,
    FileText,
    Folder,
    Inbox,
    LayoutGrid,
    LogIn,
    MapPin,
    Plus,
    Search,
    SunMoon,
    User,
    Users,
} from 'lucide-react';

/**
 * Icon keys returned by SearchProvider results. Modules adding a provider
 * add their keys here (e.g. task status icons, "doc", "sheet").
 */
const ICONS: Record<string, LucideIcon> = {
    'log-in': LogIn,
    calendar: Calendar,
    plus: Plus,
    'sun-moon': SunMoon,
    inbox: Inbox,
    'circle-check': CircleCheck,
    circle: Circle,
    'layout-grid': LayoutGrid,
    'map-pin': MapPin,
    'file-text': FileText,
    'check-check': CheckCheck,
    folder: Folder,
    bell: Bell,
    user: User,
    users: Users,
};

export function searchIcon(key: string): LucideIcon {
    return ICONS[key] ?? Search;
}
