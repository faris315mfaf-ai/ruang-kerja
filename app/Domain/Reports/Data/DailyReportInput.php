<?php

namespace App\Domain\Reports\Data;

/**
 * Validated content of a daily report form (SaveDailyReportRequest).
 */
final readonly class DailyReportInput
{
    /**
     * @param  list<DailyReportItemInput>  $items
     */
    public function __construct(
        public string $reportDate,
        public ?string $summary,
        public ?string $blockers,
        public ?string $notes,
        public array $items,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        $text = function (string $key) use ($data): ?string {
            $value = $data[$key] ?? null;

            if (! is_string($value)) {
                return null;
            }

            $value = trim(str_replace("\r\n", "\n", $value));

            return $value === '' ? null : $value;
        };

        $items = [];

        foreach (is_array($data['items'] ?? null) ? $data['items'] : [] as $item) {
            if (is_array($item)) {
                $items[] = DailyReportItemInput::fromArray($item);
            }
        }

        return new self(
            reportDate: is_string($data['report_date'] ?? null) ? $data['report_date'] : '',
            summary: $text('summary'),
            blockers: $text('blockers'),
            notes: $text('notes'),
            items: $items,
        );
    }
}
