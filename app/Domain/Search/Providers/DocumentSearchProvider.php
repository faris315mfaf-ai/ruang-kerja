<?php

namespace App\Domain\Search\Providers;

use App\Domain\Google\Enums\DriveFileKind;
use App\Domain\Search\Contracts\SearchProvider;
use App\Domain\Search\Data\SearchResult;
use App\Domain\Search\Support\LikePattern;
use App\Models\DriveFile;
use App\Models\User;
use App\Models\Workspace;

/**
 * "Dokumen" (Sprint 7): Drive files cached in drive_files, by name, limited
 * to workspaces the viewer may see (DriveFile::visibleTo → WorkspaceDriveAccess).
 * Google Docs/Sheets/Slides first; folders are not listed. Opens in Google.
 */
final class DocumentSearchProvider implements SearchProvider
{
    public function key(): string
    {
        return 'documents';
    }

    public function label(): string
    {
        return 'Dokumen';
    }

    public function minQueryLength(): int
    {
        return 2;
    }

    public function search(User $viewer, string $query, int $limit): array
    {
        $files = DriveFile::query()
            ->visibleTo($viewer)
            ->where('drive_files.kind', '!=', DriveFileKind::Folder->value)
            ->where('drive_files.name', 'ilike', LikePattern::contains($query))
            ->orderByRaw("CASE WHEN drive_files.kind IN ('doc', 'sheet', 'slide') THEN 0 ELSE 1 END")
            ->orderByDesc('drive_files.modified_at')
            ->orderBy('drive_files.name')
            ->limit($limit)
            ->get();

        $workspaceIds = $files->pluck('workspace_id')->filter()->unique()->values()->all();
        $workspaces = Workspace::query()->whereIn('id', $workspaceIds)->get(['id', 'name', 'key', 'type'])->keyBy('id');

        $results = [];

        foreach ($files as $file) {
            $workspace = $file->workspace_id === null ? null : $workspaces->get($file->workspace_id);

            $results[] = new SearchResult(
                id: 'document:'.$file->id,
                title: $file->name,
                icon: self::icon($file->kind),
                url: $file->web_view_link,
                code: $workspace?->key,
                subtitle: $file->kind->label().($workspace === null ? '' : ' · '.($workspace->isPersonal() ? 'Pribadi' : $workspace->name)),
                external: true,
            );
        }

        return $results;
    }

    private static function icon(DriveFileKind $kind): string
    {
        return match ($kind) {
            DriveFileKind::Doc => 'file-text',
            DriveFileKind::Sheet => 'sheet',
            DriveFileKind::Slide => 'slide',
            DriveFileKind::Pdf => 'file-pdf',
            DriveFileKind::Image => 'image',
            DriveFileKind::Folder => 'folder',
            DriveFileKind::Other => 'file',
        };
    }
}
