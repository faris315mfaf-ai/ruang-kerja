<?php

namespace App\Domain\Briefings\Queries;

use App\Domain\Briefings\Enums\BriefingPeriod;
use App\Domain\Briefings\Services\BriefingRecorders;
use App\Domain\Notifications\Support\IndonesianDate;
use App\Models\Briefing;
use App\Models\BriefingDelegation;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * Data of the "Catat briefing" dashboard card (keputusan pemilik 9 Okt
 * 2026): the state of today's windows (pagi 08.00–11.00, sore 16.00–18.00
 * office time), whether the viewer may record the open period, today's
 * delegations and the saved notes (today's per period, plus the latest one
 * of each period for context).
 *
 * Returns null for employees who are neither HR / Super Admin nor an
 * appointed delegate today — they see no card (the briefing arrives in
 * their Inbox instead).
 */
final class BriefingWindow
{
    public function __construct(private readonly BriefingRecorders $recorders) {}

    /**
     * @return array<string, mixed>|null
     */
    public function card(User $viewer, ?CarbonImmutable $now = null): ?array
    {
        if (! $viewer->isActive()) {
            return null;
        }

        $now ??= CarbonImmutable::now();
        $nowOffice = $now->setTimezone(config()->string('app.office_timezone'));
        $date = $nowOffice->toDateString();
        $recorder = BriefingRecorders::isRecorder($viewer);

        // One query both ways: today's delegations of the company (recorder)
        // or the viewer's own appointments (delegate) — and eligibility.
        /** @var list<BriefingDelegation> $delegations */
        $delegations = BriefingDelegation::query()
            ->with('delegate', 'delegator')
            ->whereDate('briefing_date', $date)
            ->where(
                $recorder
                    ? fn ($query) => $query->where('company_id', $viewer->company_id)
                    : fn ($query) => $query
                        ->where('company_id', $viewer->company_id)
                        ->where('delegated_to', $viewer->id),
            )
            ->get()
            ->all();

        if (! $recorder && $delegations === []) {
            return null; // plain employee: no card
        }

        $periods = [];
        $current = null;

        foreach (BriefingPeriod::cases() as $period) {
            $status = $period->isOpenAt($now) ? 'open'
                : ($nowOffice->format('H:i') < $period->startsAt() ? 'before' : 'after');

            $periods[] = [
                'value' => $period->value,
                'label' => $period->label(),
                'starts_at' => $period->startsAt(),
                'ends_at' => $period->endsAt(),
                'status' => $status,
            ];

            if ($status === 'open') {
                $current = $period;
            }
        }

        $saved = $this->savedToday($viewer, $date);

        return [
            'date' => $date,
            'date_label' => IndonesianDate::long($nowOffice),
            'is_recorder' => $recorder,
            'current' => $current?->value,
            'can_record' => $current !== null && $this->recorders->canRecord($viewer, $date, $current),
            'periods' => $periods,
            'delegations' => array_reduce(
                $delegations,
                fn (array $carry, BriefingDelegation $delegation): array => $carry + [
                    $delegation->period->value => [
                        'to' => ['id' => $delegation->delegate->id, 'name' => $delegation->delegate->name],
                        'by' => ['id' => $delegation->delegator->id, 'name' => $delegation->delegator->name],
                    ],
                ],
                [],
            ),
            'saved' => $saved,
            'latest' => $this->latestPerPeriod($viewer, $saved),
            'urls' => ['store' => '/briefing', 'delegate' => '/briefing/delegasi'],
        ];
    }

    /**
     * Today's saved notes per period ("pagi" => item|null, "sore" => …).
     *
     * @return array<string, array<string, mixed>|null>
     */
    private function savedToday(User $viewer, string $date): array
    {
        $rows = Briefing::query()
            ->with('creator', 'delegator')
            ->forCompanyDate((string) $viewer->company_id, $date)
            ->get();

        $saved = array_fill_keys(array_map(fn (BriefingPeriod $period): string => $period->value, BriefingPeriod::cases()), null);

        foreach ($rows as $row) {
            $saved[$row->period->value] = self::item($row);
        }

        return $saved;
    }

    /**
     * The latest note of each period that has none today ("lihat terakhir").
     *
     * @param  array<string, array<string, mixed>|null>  $saved
     * @return array<string, array<string, mixed>|null>
     */
    private function latestPerPeriod(User $viewer, array $saved): array
    {
        $latest = [];

        foreach (BriefingPeriod::cases() as $period) {
            $latest[$period->value] = $saved[$period->value] !== null ? null : self::item(
                Briefing::query()
                    ->with('creator', 'delegator')
                    ->where('company_id', $viewer->company_id)
                    ->where('period', $period->value)
                    ->orderByDesc('briefing_date')
                    ->first(),
            );
        }

        return $latest;
    }

    /**
     * @return array<string, mixed>|null
     */
    private static function item(?Briefing $briefing): ?array
    {
        if ($briefing === null) {
            return null;
        }

        return [
            'id' => $briefing->id,
            'date' => $briefing->briefing_date->toDateString(),
            'period' => $briefing->period->value,
            'title' => $briefing->title(),
            'content' => $briefing->content,
            'saved_by' => ['id' => $briefing->creator->id, 'name' => $briefing->creator->name],
            'delegated_from' => $briefing->delegated_from === null
                ? null
                : ['id' => $briefing->delegator?->id, 'name' => $briefing->delegator?->name],
            'saved_at' => $briefing->updated_at?->toIso8601String(),
        ];
    }
}
