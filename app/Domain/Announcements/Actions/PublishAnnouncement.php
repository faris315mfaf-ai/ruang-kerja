<?php

namespace App\Domain\Announcements\Actions;

use App\Domain\Announcements\Enums\AnnouncementAudience;
use App\Domain\Announcements\Jobs\SendAnnouncementNotifications;
use App\Domain\Announcements\Services\AnnouncementTargets;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\Announcement;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Publishes an announcement now and queues the notification
 * (`system.announcement`) to every recipient except the author, in chunks.
 */
final class PublishAnnouncement
{
    public function __construct(
        private readonly AnnouncementTargets $targets,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @param  list<string>  $targetIds
     */
    public function handle(User $author, string $title, string $body, AnnouncementAudience $audience, array $targetIds, ?CarbonImmutable $expiresAt = null): Announcement
    {
        $targetIds = array_values(array_unique($targetIds));

        if (! $this->targets->allows($author, $audience, $targetIds)) {
            throw ValidationException::withMessages(['target_ids' => $audience === AnnouncementAudience::All
                ? 'Anda tidak bisa mengirim pengumuman ke semua karyawan.'
                : 'Pilih divisi atau tim yang Anda pimpin.']);
        }

        $now = CarbonImmutable::now();

        if ($expiresAt !== null && $expiresAt->lte($now)) {
            throw ValidationException::withMessages(['expires_on' => 'Tanggal berakhir tidak boleh sebelum hari ini.']);
        }

        $announcement = DB::transaction(function () use ($author, $title, $body, $audience, $targetIds, $expiresAt, $now): Announcement {
            $announcement = Announcement::query()->create([
                'company_id' => $author->company_id,
                'author_id' => $author->id,
                'title' => trim($title),
                'body' => trim(str_replace("\r\n", "\n", $body)),
                'audience' => $audience,
                'target_ids' => $audience === AnnouncementAudience::All ? [] : $targetIds,
                'published_at' => $now,
                'expires_at' => $expiresAt,
            ]);

            $this->audit->log('announcement.published', $announcement, null, [
                'title' => $announcement->title,
                'audience' => $audience->value,
                'target_ids' => $announcement->target_ids,
            ], $author);

            return $announcement;
        });

        SendAnnouncementNotifications::dispatch($announcement->id)->afterCommit();

        return $announcement;
    }
}
