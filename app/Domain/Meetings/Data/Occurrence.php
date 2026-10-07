<?php

namespace App\Domain\Meetings\Data;

use App\Models\Meeting;
use Carbon\CarbonImmutable;

/**
 * One occurrence of a meeting: the meeting itself or one date of a series.
 * `date` is the office date ("YYYY-MM-DD"), times are UTC instants.
 */
final readonly class Occurrence
{
    public function __construct(
        public Meeting $meeting,
        public string $date,
        public CarbonImmutable $startsAt,
        public CarbonImmutable $endsAt,
    ) {}

    /** Unique key of the occurrence (React key, minutes lookup). */
    public function key(): string
    {
        return $this->meeting->id.':'.$this->date;
    }

    /** /rapat/{id} (with ?tanggal= for a recurring series). */
    public function url(string $suffix = ''): string
    {
        $path = '/rapat/'.$this->meeting->id.$suffix;

        return $this->meeting->isRecurring() ? $path.'?tanggal='.$this->date : $path;
    }

    public function overlaps(CarbonImmutable $from, CarbonImmutable $to): bool
    {
        return $this->startsAt->lt($to) && $this->endsAt->gt($from);
    }
}
