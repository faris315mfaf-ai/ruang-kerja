<?php

namespace App\Domain\Workspaces\Support;

use App\Domain\Workspaces\Contracts\HasWorkspaceAttachments;
use App\Models\Task;
use Illuminate\Database\Eloquent\Model;

/**
 * URL aliases of models that accept attachments: /lampiran/{type}/{id}.
 * Sprint 6 adds `'comment' => Comment::class` (Comment must implement
 * HasWorkspaceAttachments and have a policy with view/update).
 */
final class AttachableTypes
{
    /**
     * @var array<string, class-string<Model&HasWorkspaceAttachments>>
     */
    public const array MAP = [
        'task' => Task::class,
    ];

    /**
     * @return list<string>
     */
    public static function aliases(): array
    {
        return array_keys(self::MAP);
    }

    /**
     * The attachable for a URL alias and id, or null (→ 404).
     */
    public static function find(string $type, string $id): (Model&HasWorkspaceAttachments)|null
    {
        $class = self::MAP[$type] ?? null;

        if ($class === null || preg_match('/^[0-9A-Za-z]{26}$/', $id) !== 1) {
            return null;
        }

        $model = $class::query()->find(strtolower($id));

        return $model instanceof HasWorkspaceAttachments ? $model : null;
    }

    /**
     * URL alias of an attachable model (for the frontend), or null.
     */
    public static function aliasOf(Model $model): ?string
    {
        $alias = array_search($model::class, self::MAP, true);

        return is_string($alias) ? $alias : null;
    }
}
