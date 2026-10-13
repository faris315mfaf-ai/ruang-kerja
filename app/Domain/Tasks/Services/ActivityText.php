<?php

namespace App\Domain\Tasks\Services;

use App\Domain\Tasks\Enums\TaskPriority;

/**
 * Indonesian sentence (without the actor) for a task feed entry — the PHP
 * twin of describeActivity() in resources/js/features/workspaces/activity-text.ts
 * for the mobile app, e.g. "memindahkan PLQ-21 dari Todo ke Sedang dikerjakan".
 * Workspace/project events fall back to their event name (they never appear
 * in a task's own feed).
 */
final class ActivityText
{
    private const array MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    /**
     * The activity groups of the "filter jenis" chips: group → events.
     *
     * @var array<string, list<string>>
     */
    public const array GROUPS = [
        'status' => ['task.created', 'task.status_changed'],
        'penugasan' => ['task.assigned', 'task.unassigned'],
        'tenggat' => ['task.due_date_changed', 'task.start_date_changed', 'task.estimate_changed'],
        'prioritas' => ['task.priority_changed'],
        'isi' => ['task.renamed', 'task.description_changed'],
        'checklist' => ['task.checklist_completed', 'task.subtask_added'],
        'lampiran' => ['task.attachment_added', 'task.attachment_removed'],
    ];

    /**
     * @param  array<string, mixed>  $properties
     * @param  array<string, string>  $names  user id => name (for assignments)
     */
    public static function describe(string $event, array $properties, array $names = []): string
    {
        $key = self::str($properties['key'] ?? null);
        $people = function (mixed $ids) use ($names): string {
            $ids = is_array($ids) ? $ids : [];

            return implode(', ', array_map(fn (mixed $id): string => $names[(string) $id] ?? 'seseorang', $ids))
                ?: count($ids).' orang';
        };

        return match ($event) {
            'task.created' => "membuat {$key} “".self::str($properties['title'] ?? null).'”',
            'task.status_changed' => "memindahkan {$key} dari ".self::nested($properties['from'] ?? null, 'name').' ke '.self::nested($properties['to'] ?? null, 'name'),
            'task.assigned' => "menugaskan {$key} ke ".$people($properties['user_ids'] ?? null),
            'task.unassigned' => 'melepas '.$people($properties['user_ids'] ?? null)." dari {$key}",
            'task.due_date_changed' => ($properties['to'] ?? null)
                ? "mengubah tenggat {$key} menjadi ".self::dayMonth(self::str($properties['to']))
                : "menghapus tenggat {$key}",
            'task.priority_changed' => "mengubah prioritas {$key} menjadi ".(TaskPriority::tryFrom((int) ($properties['to'] ?? 0))?->label() ?? '–'),
            'task.renamed' => "mengganti judul {$key} menjadi “".self::str($properties['to'] ?? null).'”',
            'task.start_date_changed' => ($properties['to'] ?? null)
                ? "mengubah tanggal mulai {$key} menjadi ".self::dayMonth(self::str($properties['to']))
                : "menghapus tanggal mulai {$key}",
            'task.estimate_changed' => is_int($properties['to'] ?? null) || is_float($properties['to'] ?? null)
                ? "mengubah estimasi {$key} menjadi ".str_replace('.', ',', (string) $properties['to']).' jam'
                : "menghapus estimasi {$key}",
            'task.description_changed' => "memperbarui deskripsi {$key}",
            'task.checklist_completed' => 'menyelesaikan “'.self::str($properties['item'] ?? null)."” di {$key}",
            'task.subtask_added' => 'menambahkan sub-tugas '.self::nested($properties['subtask'] ?? null, 'key')." ke {$key}",
            'task.attachment_added' => 'melampirkan '.self::str($properties['filename'] ?? null)." di {$key}",
            'task.attachment_removed' => 'melepas lampiran '.self::str($properties['filename'] ?? null)." dari {$key}",
            'task.deleted' => "menghapus {$key} “".self::str($properties['title'] ?? null).'”',
            default => $event,
        };
    }

    /**
     * User ids an entry's sentence refers to (to resolve names in one query).
     *
     * @param  array<string, mixed>  $properties
     * @return list<string>
     */
    public static function userIds(array $properties): array
    {
        $ids = $properties['user_ids'] ?? null;

        return is_array($ids) ? array_values(array_filter(array_map(strval(...), $ids))) : [];
    }

    private static function str(mixed $value): string
    {
        return is_string($value) ? $value : '';
    }

    private static function nested(mixed $value, string $key): string
    {
        return is_array($value) ? self::str($value[$key] ?? null) : '';
    }

    private static function dayMonth(string $date): string
    {
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $date, $match) !== 1) {
            return $date;
        }

        return (int) $match[3].' '.(self::MONTHS[(int) $match[2] - 1] ?? '');
    }
}
