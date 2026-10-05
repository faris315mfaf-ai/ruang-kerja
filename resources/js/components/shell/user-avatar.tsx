import {
    Avatar,
    AvatarFallback,
    AvatarImage,
    avatarTone,
} from '@/components/ui/avatar';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';

type Props = {
    name: string;
    src?: string | null;
    className?: string;
    /**
     * Gradient merek ring around the avatar (the signed-in person in the menu
     * bar and on the phone home screen, Komponen "Avatar" first example).
     */
    ring?: boolean;
};

/** Photo or initials on a per-person tone (blue · teal · amber). */
export function UserAvatar({ name, src, className, ring = false }: Props) {
    const getInitials = useInitials();

    return (
        <Avatar
            className={cn(
                'size-8 overflow-hidden rounded-full text-[13px]',
                ring && 'bg-grad-merek p-0.5',
                className,
            )}
        >
            {src && (
                <AvatarImage
                    src={src}
                    alt={name}
                    className={cn(ring && 'rounded-full')}
                />
            )}
            <AvatarFallback
                className={cn(
                    'rounded-full font-bold',
                    ring ? 'bg-surface text-text' : avatarTone(name),
                )}
            >
                {getInitials(name)}
            </AvatarFallback>
        </Avatar>
    );
}
