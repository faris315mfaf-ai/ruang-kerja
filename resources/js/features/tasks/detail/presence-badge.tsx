import { AvatarStack } from "../avatar-stack";
import { presenceLabel } from "../realtime/presence";
import type { Person } from "../types";

/** "Sari sedang melihat" with avatars (presence channel). */
export function PresenceBadge({
  people,
  compact = false,
}: {
  people: Person[];
  compact?: boolean;
}) {
  const label = presenceLabel(people);

  if (!label) {
    return null;
  }

  return (
    <span
      role="status"
      aria-label={label}
      title={label}
      className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface pr-3.5 pl-1.5 text-[14px] font-semibold text-text"
    >
      <span className="relative">
        <AvatarStack people={people} max={3} />
        <span
          aria-hidden
          className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full bg-success ring-2 ring-surface"
        />
      </span>
      {!compact && <span className="whitespace-nowrap">{label}</span>}
    </span>
  );
}
