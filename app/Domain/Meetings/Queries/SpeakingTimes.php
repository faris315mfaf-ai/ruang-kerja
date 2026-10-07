<?php

namespace App\Domain\Meetings\Queries;

use App\Domain\Meetings\Data\Occurrence;
use App\Models\MeetingSpeakingTime;
use Carbon\CarbonImmutable;

/**
 * "Waktu bicara" of one occurrence (meeting_speaking_times, one query):
 * everyone's reported total, their rounded share of the room's total, and
 * who joined (or reported) without speaking yet ("belum bicara").
 */
final class SpeakingTimes
{
    /** How often clients report their own total (seconds). */
    public const int REPORT_INTERVAL_SECONDS = 15;

    public function __construct(private readonly VideoAttendance $attendance) {}

    /**
     * Totals shared with everyone in the room (broadcast payload).
     *
     * @param  list<string>|null  $attended  ids of people who joined the room (null = query them)
     * @return array{occurrence_date: string, total_ms: int, updated_at: string|null, people: list<array{user_id: string, ms: int, share: int}>, silent: list<string>}
     */
    public function totals(Occurrence $occurrence, ?array $attended = null): array
    {
        $rows = MeetingSpeakingTime::query()
            ->where('meeting_id', $occurrence->meeting->id)
            ->where('occurrence_date', $occurrence->date)
            ->orderByDesc('ms_spoken')
            ->orderBy('user_id')
            ->get(['user_id', 'ms_spoken', 'updated_at']);

        $attended ??= $this->attendance->attendedUserIds($occurrence);
        $total = (int) $rows->sum('ms_spoken');
        $latest = null;
        $people = [];
        $spoke = [];
        $silent = [];

        foreach ($rows as $row) {
            $ms = $row->ms_spoken;
            $people[] = [
                'user_id' => $row->user_id,
                'ms' => $ms,
                'share' => $total > 0 ? (int) round($ms * 100 / $total) : 0,
            ];

            if ($ms > 0) {
                $spoke[$row->user_id] = true;
            } else {
                $silent[$row->user_id] = true;
            }

            if ($row->updated_at !== null && ($latest === null || $row->updated_at->gt($latest))) {
                $latest = $row->updated_at;
            }
        }

        foreach ($attended as $id) {
            if (! isset($spoke[$id])) {
                $silent[$id] = true;
            }
        }

        return [
            'occurrence_date' => $occurrence->date,
            'total_ms' => $total,
            'updated_at' => $latest instanceof CarbonImmutable ? $latest->toIso8601ZuluString() : null,
            'people' => $people,
            'silent' => array_keys($silent),
        ];
    }

    /**
     * Totals + the viewer's own stored value (seed of the client counter).
     *
     * @param  list<string>|null  $attended
     * @return array<string, mixed>
     */
    public function forViewer(Occurrence $occurrence, string $viewerId, ?array $attended = null): array
    {
        $totals = $this->totals($occurrence, $attended);
        $mine = 0;

        foreach ($totals['people'] as $person) {
            if ($person['user_id'] === $viewerId) {
                $mine = $person['ms'];
            }
        }

        return [...$totals, 'mine_ms' => $mine, 'interval_seconds' => self::REPORT_INTERVAL_SECONDS];
    }
}
