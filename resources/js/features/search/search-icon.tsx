import type { LucideIcon } from 'lucide-react';
import {
    Bell,
    Calendar,
    CheckCheck,
    Circle,
    CircleCheck,
    File,
    FileImage,
    FileSpreadsheet,
    FileText,
    FileType,
    Folder,
    Inbox,
    LayoutGrid,
    LogIn,
    MapPin,
    Plus,
    Presentation,
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
    sheet: FileSpreadsheet,
    slide: Presentation,
    'file-pdf': FileType,
    image: FileImage,
    file: File,
    'check-check': CheckCheck,
    folder: Folder,
    bell: Bell,
    user: User,
    users: Users,
};

export function searchIcon(key: string): LucideIcon {
    return ICONS[key] ?? Search;
}
