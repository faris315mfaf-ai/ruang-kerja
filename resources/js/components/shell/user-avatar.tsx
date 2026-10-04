import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';

type Props = {
    name: string;
    src?: string | null;
    className?: string;
};

export function UserAvatar({ name, src, className }: Props) {
    const getInitials = useInitials();

    return (
        <Avatar className={cn('size-8 overflow-hidden rounded-full', className)}>
            {src && <AvatarImage src={src} alt={name} />}
            <AvatarFallback className="rounded-full bg-brand-600 text-xs font-semibold text-on-brand">
                {getInitials(name)}
            </AvatarFallback>
        </Avatar>
    );
}
