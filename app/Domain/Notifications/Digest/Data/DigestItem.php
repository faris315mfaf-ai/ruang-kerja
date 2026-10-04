<?php

namespace App\Domain\Notifications\Digest\Data;

/**
 * One row in a digest section, e.g. "OPS-145 · Laporan mingguan operasional · 17.00".
 */
final readonly class DigestItem
{
    /**
     * @param  string|null  $code  mono identifier (task key, request number)
     * @param  string|null  $detail  muted text after the title ("12–14 Okt · 3 hari kerja")
     * @param  string|null  $trailing  right-aligned mono text (time)
     * @param  string|null  $badge  right-aligned pill ("Cuti", "Lewat 1 hari kerja")
     * @param  string  $badgeTone  neutral · info · warning · danger · success
     * @param  string|null  $avatarName  shows initials before the title
     */
    public function __construct(
        public string $title,
        public ?string $code = null,
        public ?string $detail = null,
        public ?string $trailing = null,
        public ?string $badge = null,
        public string $badgeTone = 'neutral',
        public ?string $avatarName = null,
    ) {}

    /**
     * @return array<string, string|null>
     */
    public function toArray(): array
    {
        return [
            'title' => $this->title,
            'code' => $this->code,
            'detail' => $this->detail,
            'trailing' => $this->trailing,
            'badge' => $this->badge,
            'badge_tone' => $this->badgeTone,
            'avatar_name' => $this->avatarName,
        ];
    }
}
