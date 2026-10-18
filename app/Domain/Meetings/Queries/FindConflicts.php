<?php

namespace App\Domain\Meetings\Queries;

use App\Domain\Meetings\Enums\Rsvp;
use App\Domain\Meetings\Services\MeetingOccurrences;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Models\Meeting;
use App\Models\MeetingParticipant;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * Schedule conflicts for the form (/rapat/baru): which internal participants
 * already have a RuangKerja meeting (organizer or invited, not declined, not
 * canceled; recurring series expanded) overlapping the proposed time, plus
 * the earliest start that day — 30-minute steps until 17.00 office time —
 * at which everyone is free. Only RuangKerja meetings: Google Calendar
 * free/busy is on hold. Titles of meetings the viewer cannot see are hidden.
 */
final class FindConflicts
{
    public const string DAY_END = '17:00';

    public function __construct(private readonly MeetingOccurrences $occurrences) {}

    /**
     * @param  list<string>  $userIds
     * @return array{conflicts: list<array{user_id: string, title: string, starts_at: string, ends_at: string}>, suggestion: string|null}
     */
    public function handle(User $viewer, array $userIds, CarbonImmutable $startsAt, CarbonImmutable $endsAt, ?string $ignoreMeetingId = null): array
    {
        $timezone = CurrentCompany::timezone();
        $dayStart = $startsAt->setTimezone($timezone)->startOfDay();
        $dayEnd = $dayStart->addDay();
        $busy = $this->busy($viewer, $userIds, $dayStart->utc(), $dayEnd->utc(), $ignoreMeetingId);

        $conflicts = $this->conflictsAt($busy, $startsAt, $endsAt);
        $suggestion = $conflicts === [] ? null : $this->suggest($busy, $startsAt, (int) $startsAt->diffInMinutes($endsAt));

        return ['conflicts' => $conflicts, 'suggestion' => $suggestion];
    }

    /**
     * @param  list<array{user_id: string, title: string, from: CarbonImmutable, to: CarbonImmutable}>  $busy
     * @return list<array{user_id: string, title: string, starts_at: string, ends_at: string}>
     */
    private function conflictsAt(array $busy, CarbonImmutable $startsAt, CarbonImmutable $endsAt): array
    {
        $result = [];

        foreach ($busy as $block) {
            if ($block['from']->lt($endsAt) && $block['to']->gt($startsAt)) {
                $result[] = [
                    'user_id' => $block['user_id'],
                    'title' => $block['title'],
                    'starts_at' => $block['from']->toIso8601ZuluString(),
                    'ends_at' => $block['to']->toIso8601ZuluString(),
                ];
            }
        }

        usort($result, fn (array $a, array $b): int => strcmp($a['starts_at'], $b['starts_at']));

        return $result;
    }

    /**
     * @param  list<array{user_id: string, title: string, from: CarbonImmutable, to: CarbonImmutable}>  $busy
     */
    private function suggest(array $busy, CarbonImmutable $startsAt, int $duration): ?string
    {
        $timezone = CurrentCompany::timezone();
        $local = $startsAt->setTimezone($timezone);
        $limit = CarbonImmutable::parse($local->toDateString().' '.self::DAY_END, $timezone);
        $minutes = (int) (ceil(($local->hour * 60 + $local->minute) / 30) * 30);
        $candidate = $local->startOfDay()->addMinutes($minutes);

        for (; $candidate->addMinutes($duration)->lte($limit); $candidate = $candidate->addMinutes(30)) {
            if ($this->conflictsAt($busy, $candidate->utc(), $candidate->addMinutes($duration)->utc()) === []) {
                return $candidate->format('H:i');
            }
        }

        return null;
    }

    /**
     * Busy blocks of the participants on that office day.
     *
     * @param  list<string>  $userIds
     * @return list<array{user_id: string, title: string, from: CarbonImmutable, to: CarbonImmutable}>
     */
    private function busy(User $viewer, array $userIds, CarbonImmutable $from, CarbonImmutable $to, ?string $ignoreMeetingId): array
    {
        $ids = array_values(array_unique($userIds));

        if ($ids === []) {
            return [];
        }

        $series = Meeting::query()
            ->where('company_id', $viewer->company_id)
            ->active()
            ->when($ignoreMeetingId !== null, fn (Builder $query) => $query->whereKeyNot($ignoreMeetingId))
            ->where(fn (Builder $query) => $query->whereIn('organizer_id', $ids)
                ->orWhereHas('participants', fn (Builder $participant) => $participant->whereIn('user_id', $ids)->where('rsvp', '!=', Rsvp::No->value)))
            ->overlapping($from, $to)
            ->with('participants')
            ->get();

        $visible = Meeting::query()->visibleTo($viewer)->whereIn('id', $series->pluck('id')->all())->pluck('id')->flip();
        $blocks = [];

        foreach ($this->occurrences->between($series, $from, $to) as $occurrence) {
            $meeting = $occurrence->meeting;
            $busyIds = $meeting->participants
                ->filter(fn (MeetingParticipant $participant): bool => $participant->user_id !== null && $participant->rsvp !== Rsvp::No)
                ->pluck('user_id')
                ->push($meeting->organizer_id)
                ->unique()
                ->intersect($ids);

            foreach ($busyIds as $id) {
                $blocks[] = [
                    'user_id' => (string) $id,
                    'title' => isset($visible[$meeting->id]) ? $meeting->title : 'Rapat lain',
                    'from' => $occurrence->startsAt,
                    'to' => $occurrence->endsAt,
                ];
            }
        }

        return $blocks;
    }
}
