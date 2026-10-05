<?php

namespace App\Domain\Notifications\Data;

use Illuminate\Database\Eloquent\Model;

/**
 * The record a notification is about (task, request, attendance day, …).
 *
 * `type`/`id` are stored in `notifications.subject_type/subject_id` so modules
 * can resolve "Perlu tindakan" items and avoid duplicates per subject.
 * `code` (e.g. "PLQ-15", "CUT-2026-10-0014") and `title` are display hints.
 */
final readonly class NotificationSubject
{
    public function __construct(
        public string $type,
        public string $id,
        public ?string $code = null,
        public ?string $title = null,
    ) {}

    public static function fromModel(Model $model, ?string $code = null, ?string $title = null): self
    {
        $key = $model->getKey();

        return new self($model->getMorphClass(), is_scalar($key) ? (string) $key : '', $code, $title);
    }

    /**
     * @return array{type: string, id: string, code: string|null, title: string|null}
     */
    public function toArray(): array
    {
        return ['type' => $this->type, 'id' => $this->id, 'code' => $this->code, 'title' => $this->title];
    }
}
