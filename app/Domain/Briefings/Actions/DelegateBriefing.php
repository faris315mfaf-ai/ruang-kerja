<?php

namespace App\Domain\Briefings\Actions;

use App\Domain\Briefings\Enums\BriefingPeriod;
use App\Domain\Notifications\Notifications\SystemAnnouncement;
use App\Domain\Notifications\Support\IndonesianDate;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\BriefingDelegation;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * HR / Super Admin delegates the note-taking of one date + period to an
 * employee (keputusan pemilik 9 Okt 2026) — e.g. when they are away. One
 * delegation per company + date + period: appointing again replaces the
 * target. The delegate is notified in-app immediately.
 */
final class DelegateBriefing
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function handle(User $actor, User $delegate, BriefingPeriod $period, ?CarbonImmutable $now = null): BriefingDelegation
    {
        $now ??= CarbonImmutable::now();
        $date = $now->setTimezone(config()->string('app.office_timezone'));

        if ($delegate->id === $actor->id) {
            throw ValidationException::withMessages(['user_id' => 'Tidak bisa mendelegasikan ke diri sendiri.']);
        }

        if (! $delegate->isActive() || $delegate->company_id !== $actor->company_id) {
            throw ValidationException::withMessages(['user_id' => 'Pilih karyawan aktif di perusahaan Anda.']);
        }

        if ($period->hasEndedAt($now)) {
            throw ValidationException::withMessages([
                'period' => sprintf(
                    '%s hari ini sudah lewat (pukul %s–%s). Pilih briefing yang belum berakhir.',
                    $period->label(),
                    $period->startsAt(),
                    $period->endsAt(),
                ),
            ]);
        }

        $delegation = DB::transaction(function () use ($actor, $delegate, $period, $date): BriefingDelegation {
            // Advisory lock: the first delegation of the day has no row to
            // lock yet; two appointments at once must not race into the
            // unique index (500).
            DB::select('select pg_advisory_xact_lock(hashtext(?))', [sprintf('briefing-delegation:%s:%s:%s', $actor->company_id, $date->toDateString(), $period->value)]);

            $delegation = BriefingDelegation::query()
                ->where('company_id', $actor->company_id)
                ->whereDate('briefing_date', $date->toDateString())
                ->where('period', $period->value)
                ->lockForUpdate()
                ->firstOrNew();

            $delegation->fill([
                'company_id' => $actor->company_id,
                'briefing_date' => $date->toDateString(),
                'period' => $period,
                'delegated_to' => $delegate->id,
                'delegated_by' => $actor->id,
            ]);
            $delegation->save();

            $this->audit->log('briefing.delegated', $delegation, null, [
                'briefing_date' => $date->toDateString(),
                'period' => $period->value,
                'delegated_to' => $delegate->id,
            ], $actor);

            return $delegation;
        });

        $delegate->notify(new SystemAnnouncement(
            title: sprintf('Anda ditunjuk mencatat briefing %s', $period->value),
            body: sprintf(
                '%s menunjuk Anda mencatat notulensi briefing %s %s, pukul %s–%s.',
                $actor->name,
                $period->value,
                IndonesianDate::long($date),
                $period->startsAt(),
                $period->endsAt(),
            ),
            url: '/dashboard',
            actor: $actor,
        ));

        return $delegation;
    }
}
