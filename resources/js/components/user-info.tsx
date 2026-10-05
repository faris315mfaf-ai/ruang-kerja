import { UserAvatar } from '@/components/shell/user-avatar';
import type { User } from '@/types';

export function UserInfo({
    user,
    showEmail = false,
}: {
    user: User;
    showEmail?: boolean;
}) {
    return (
        <>
            <UserAvatar
                name={user.name}
                src={user.avatar}
                className="size-10 text-[15px]"
            />
            <div className="grid flex-1 gap-0.5 text-left">
                <span className="truncate text-[16px] leading-6 font-semibold text-text">
                    {user.name}
                </span>
                {showEmail && (
                    <span className="truncate text-[14px] leading-5 text-text-muted">
                        {user.email}
                    </span>
                )}
            </div>
        </>
    );
}
