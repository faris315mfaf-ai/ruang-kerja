<?php

namespace App\Domain\Notifications\Digest\Data;

use App\Models\User;
use Carbon\CarbonImmutable;

final readonly class DailyDigest
{
    /**
     * @param  list<DigestSectionData>  $sections  non-empty sections only
     */
    public function __construct(
        public User $user,
        public CarbonImmutable $date,
        public array $sections,
    ) {}

    public function isEmpty(): bool
    {
        return $this->sections === [];
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'date' => $this->date->toDateString(),
            'sections' => array_map(fn (DigestSectionData $section): array => $section->toArray(), $this->sections),
        ];
    }
}
