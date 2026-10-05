<?php

namespace App\Domain\Notifications\Digest\Contracts;

use App\Domain\Notifications\Digest\Data\DigestSectionData;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * One block of the daily digest email (e.g. "Tenggat hari ini", "Terlambat",
 * "Menunggu persetujuan Anda"). Register the class in
 * config/notifications.php → digest.sections (display order).
 *
 * Return null (or a section without items) when there is nothing to report;
 * a digest whose sections are all empty is not sent.
 */
interface DigestSection
{
    /**
     * @param  CarbonImmutable  $date  the digest's calendar day in the office timezone (start of day)
     */
    public function build(User $user, CarbonImmutable $date): ?DigestSectionData;
}
