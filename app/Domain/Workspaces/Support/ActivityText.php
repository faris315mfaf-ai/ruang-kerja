<?php

namespace App\Domain\Workspaces\Support;

use App\Domain\Tasks\Enums\TaskPriority;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use Carbon\CarbonImmutable;

/**
 * Indonesian sentence (without the actor) for an `activities` row, e.g.
 * "memindahkan OPS-142 dari Todo ke Sedang dikerjakan". Port of
 * resources/js/features/workspaces/activity-text.ts so the mobile feed reads
 * the same as the web feed.
 */
final class ActivityText
{
    private const array HEALTH = ['on_track' => 'Sesuai jalur', 'at_risk' => 'Berisiko', 'off_track' => 'Bermasalah'];

    /**
     * @param  array<string, mixed>  $p  activities.properties
     * @param  array<string, string>  $names  user id => name (for `user_ids`)
     */
    public static function describe(string $event, array $p, array $names = []): string
    {
        $key = self::str($p['key'] ?? null);
        $people = function (mixed $ids) use ($names): string {
            if (! is_array($ids)) {
                return '';
            }

            return implode(', ', array_map(fn (mixed $id): string => $names[(string) $id] ?? 'seseorang', $ids));
        };
        $count = fn (mixed $value): int => is_array($value) ? count($value) : 0;

        return match ($event) {
            'task.created' => "membuat {$key} “".self::str($p['title'] ?? null).'”',
            'task.status_changed' => "memindahkan {$key} dari ".self::nested($p['from'] ?? null, 'name').' ke '.self::nested($p['to'] ?? null, 'name'),
            'task.assigned' => "menugaskan {$key} ke ".($people($p['user_ids'] ?? null) ?: $count($p['user_ids'] ?? null).' orang'),
            'task.unassigned' => 'melepas '.($people($p['user_ids'] ?? null) ?: $count($p['user_ids'] ?? null).' orang')." dari {$key}",
            'task.due_date_changed' => ($p['to'] ?? null) ? "mengubah tenggat {$key} menjadi ".self::dayMonth(self::str($p['to'])) : "menghapus tenggat {$key}",
            'task.priority_changed' => "mengubah prioritas {$key} menjadi ".(TaskPriority::tryFrom((int) ($p['to'] ?? -1))?->label() ?? '–'),
            'task.renamed' => "mengganti judul {$key} menjadi “".self::str($p['to'] ?? null).'”',
            'task.start_date_changed' => ($p['to'] ?? null) ? "mengubah tanggal mulai {$key} menjadi ".self::dayMonth(self::str($p['to'])) : "menghapus tanggal mulai {$key}",
            'task.estimate_changed' => is_int($p['to'] ?? null) || is_float($p['to'] ?? null)
                ? "mengubah estimasi {$key} menjadi ".str_replace('.', ',', (string) $p['to']).' jam'
                : "menghapus estimasi {$key}",
            'task.description_changed' => "memperbarui deskripsi {$key}",
            'task.checklist_completed' => 'menyelesaikan “'.self::str($p['item'] ?? null)."” di {$key}",
            'task.subtask_added' => 'menambahkan sub-tugas '.self::nested($p['subtask'] ?? null, 'key')." ke {$key}",
            'task.attachment_added' => 'melampirkan '.self::str($p['filename'] ?? null)." di {$key}",
            'task.attachment_removed' => 'melepas lampiran '.self::str($p['filename'] ?? null)." dari {$key}",
            'task.deleted' => "menghapus {$key} “".self::str($p['title'] ?? null).'”',
            'workspace.created' => 'membuat workspace ini',
            'workspace.updated' => 'mengubah pengaturan workspace',
            'workspace.archived' => 'mengarsipkan workspace',
            'workspace.restored' => 'memulihkan workspace dari arsip',
            'workspace.member_added' => 'menambahkan '.self::str($p['name'] ?? null).' sebagai '.self::role(self::str($p['role'] ?? null)),
            'workspace.member_removed' => 'mengeluarkan '.self::str($p['name'] ?? null),
            'workspace.member_role_changed' => 'mengubah peran '.self::str($p['name'] ?? null).' menjadi '.self::role(self::str($p['to'] ?? null)),
            'project.attributes_changed' => 'mengubah atribut proyek',
            'project.update_posted' => 'menulis update proyek ('.(self::HEALTH[self::str($p['health'] ?? null)] ?? self::str($p['health'] ?? null)).')'.(($p['decision_needed'] ?? null) ? ' dan meminta keputusan Direksi' : ''),
            'project.update_requested' => 'meminta update proyek dari '.self::str($p['recipient'] ?? null),
            'project.direction_given' => 'memberi arahan: “'.self::str($p['body'] ?? null).'”',
            'project.decision_resolved' => 'menandai keputusan selesai: “'.self::str($p['decision'] ?? null).'”',
            'milestone.created' => 'menambahkan milestone “'.self::str($p['name'] ?? null).'”',
            'milestone.updated' => 'mengubah milestone “'.self::str($p['name'] ?? null).'”',
            'milestone.completed' => 'menandai milestone “'.self::str($p['name'] ?? null).'” selesai',
            'milestone.reopened' => 'membuka kembali milestone “'.self::str($p['name'] ?? null).'”',
            'milestone.deleted' => 'menghapus milestone “'.self::str($p['name'] ?? null).'”',
            'risk.created' => 'mencatat risiko “'.self::str($p['title'] ?? null).'”',
            'risk.updated' => 'mengubah risiko “'.self::str($p['title'] ?? null).'”',
            'risk.resolved' => 'menandai risiko “'.self::str($p['title'] ?? null).'” teratasi',
            'risk.deleted' => 'menghapus risiko “'.self::str($p['title'] ?? null).'”',
            default => $event,
        };
    }

    /**
     * User ids mentioned by `user_ids` properties, to resolve names in one query.
     *
     * @param  array<string, mixed>  $properties
     * @return list<string>
     */
    public static function userIds(array $properties): array
    {
        $ids = $properties['user_ids'] ?? null;

        return is_array($ids) ? array_values(array_filter($ids, 'is_string')) : [];
    }

    private static function str(mixed $value): string
    {
        return is_string($value) ? $value : '';
    }

    private static function nested(mixed $value, string $key): string
    {
        return is_array($value) ? self::str($value[$key] ?? null) : '';
    }

    private static function role(string $role): string
    {
        return WorkspaceRole::tryFrom($role)?->label() ?? $role;
    }

    /** "5 Okt" like formatDayMonth(). */
    private static function dayMonth(string $date): string
    {
        static $months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

        try {
            $day = CarbonImmutable::parse($date);
        } catch (\Throwable) {
            return $date;
        }

        return $day->day.' '.$months[$day->month - 1];
    }
}
