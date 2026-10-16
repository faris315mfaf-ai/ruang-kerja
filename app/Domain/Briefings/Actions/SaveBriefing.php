<?php

namespace App\Domain\Briefings\Actions;

use App\Domain\Briefings\Enums\BriefingPeriod;
use App\Domain\Briefings\Jobs\SendBriefingNotifications;
use App\Domain\Briefings\Services\BriefingRecorders;
use App\Domain\Briefings\Support\BriefingDay;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\Briefing;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Saves the minutes of one briefing (keputusan pemilik 9 Okt 2026).
 *
 * Upsert per company + office date + period: saving again replaces the
 * content without a second notification (idempotent — only the first save
 * notifies the company). The recorder is HR / Super Admin or the appointed
 * delegate; notes are only accepted inside the period's window.
 */
final class SaveBriefing
{
    public function __construct(
        private readonly BriefingRecorders $recorders,
        private readonly AuditLogger $audit,
    ) {}

    public function handle(User $actor, BriefingPeriod $period, string $content, ?CarbonImmutable $now = null): Briefing
    {
        $now ??= CarbonImmutable::now();
        $date = BriefingDay::today($now);

        if (! $period->isOpenAt($now)) {
            throw ValidationException::withMessages([
                'period' => sprintf(
                    '%s hanya bisa dicatat pukul %s–%s waktu kantor.',
                    $period->label(),
                    $period->startsAt(),
                    $period->endsAt(),
                ),
            ]);
        }

        if (! $this->recorders->canRecord($actor, $date, $period)) {
            throw ValidationException::withMessages([
                'period' => 'Hanya HR, Super Admin, atau yang ditunjuk yang bisa mencatat briefing.',
            ]);
        }

        $content = trim(str_replace("\r\n", "\n", $content));

        [$briefing, $created] = DB::transaction(function () use ($actor, $period, $content, $date): array {
            // Advisory lock on company + date + period: a row lock cannot
            // guard the very first save (no row yet), so two recorders saving
            // at once would race into the unique index (500). The second one
            // waits here, then updates the row the first one created.
            DB::select('select pg_advisory_xact_lock(hashtext(?))', [sprintf('briefing:%s:%s:%s', $actor->company_id, $date, $period->value)]);

            $existing = Briefing::query()
                ->forCompanyDate((string) $actor->company_id, $date)
                ->where('period', $period->value)
                ->lockForUpdate()
                ->first();

            // When a delegate saves, remember who appointed them.
            $delegatedFrom = BriefingRecorders::isRecorder($actor)
                ? null
                : $this->recorders->delegationFor((string) $actor->company_id, $date, $period)?->delegated_by;

            if ($existing !== null) {
                $existing->update([
                    'content' => $content,
                    'created_by' => $actor->id,
                    'delegated_from' => $delegatedFrom,
                ]);

                $briefing = $existing;
                $created = false;
            } else {
                $briefing = Briefing::query()->create([
                    'company_id' => $actor->company_id,
                    'period' => $period,
                    'briefing_date' => $date,
                    'content' => $content,
                    'created_by' => $actor->id,
                    'delegated_from' => $delegatedFrom,
                ]);

                $created = true;
            }

            $this->audit->log('briefing.saved', $briefing, null, [
                'briefing_date' => $date,
                'period' => $period->value,
                'created' => $created,
                'content_chars' => mb_strlen($content),
            ], $actor);

            return [$briefing, $created];
        });

        if ($created) {
            SendBriefingNotifications::dispatch($briefing->id)->afterCommit();
        }

        return $briefing;
    }
}
