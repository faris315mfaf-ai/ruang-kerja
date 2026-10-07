<?php

namespace App\Domain\Meetings\Transcripts\Actions;

use App\Domain\Meetings\Transcripts\Services\NotulenConfig;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\Meeting;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Organizer switches "Notulen otomatis" for a video meeting (the whole
 * series). Switching on needs a configured worker; switching off always
 * works (a running recording is then ignored when it arrives). Audited.
 */
final class SetAutoMinutes
{
    public function __construct(
        private readonly NotulenConfig $config,
        private readonly AuditLogger $audit,
    ) {}

    public function handle(Meeting $meeting, User $actor, bool $enabled): Meeting
    {
        if ($enabled && ! $this->config->availableFor($meeting)) {
            throw ValidationException::withMessages([
                'auto_minutes' => 'Notulen otomatis hanya untuk rapat Video RuangKerja dan belum disiapkan admin di server ini.',
            ]);
        }

        $before = NotulenConfig::autoMinutes($meeting);

        if ($before !== $enabled) {
            $meeting->forceFill(['auto_minutes' => $enabled])->save();
            $this->audit->log('meeting.auto_minutes_changed', $meeting, ['auto_minutes' => $before], ['auto_minutes' => $enabled], $actor);
        }

        return $meeting;
    }
}
