<?php

namespace App\Domain\Reports\Data;

/**
 * One row of a daily report: a task (or other work when taskId is null),
 * the progress note, optional percent/hours and an optional column to move
 * the task to when the report is sent.
 */
final readonly class DailyReportItemInput
{
    public function __construct(
        public ?string $taskId,
        public string $progressNote,
        public ?int $percent,
        public ?float $hours,
        public ?string $moveStatusId,
    ) {}

    /**
     * @param  array<mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        $string = fn (string $key): ?string => is_string($data[$key] ?? null) && trim($data[$key]) !== '' ? trim($data[$key]) : null;
        $percent = $data['percent'] ?? null;
        $hours = $data['hours'] ?? null;

        return new self(
            taskId: $string('task_id'),
            progressNote: trim(str_replace("\r\n", "\n", is_string($data['progress_note'] ?? null) ? $data['progress_note'] : '')),
            percent: is_numeric($percent) ? (int) $percent : null,
            hours: is_numeric($hours) ? round((float) $hours, 2) : null,
            moveStatusId: $string('move_status_id'),
        );
    }
}
