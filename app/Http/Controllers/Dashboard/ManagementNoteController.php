<?php

namespace App\Http\Controllers\Dashboard;

use App\Domain\Analytics\Data\Period;
use App\Domain\Monitoring\Actions\CreateManagementNote;
use App\Domain\Monitoring\Actions\DeleteManagementNote;
use App\Domain\Monitoring\Actions\ReorderManagementNotes;
use App\Domain\Monitoring\Actions\UpdateManagementNote;
use App\Domain\Monitoring\Queries\ManagementNotes;
use App\Http\Controllers\Controller;
use App\Http\Requests\Monitoring\ManagementNoteRequest;
use App\Models\ManagementNote;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * "Catatan tindakan" of Direksi / management (keputusan pemilik 6 Okt 2026):
 * JSON endpoints for the optimistic list on the Direksi dashboard and
 * /manajemen. Owner only (ManagementNotePolicy: another person's note = 404).
 */
class ManagementNoteController extends Controller
{
    public function store(ManagementNoteRequest $request, #[CurrentUser] User $user, CreateManagementNote $create): JsonResponse
    {
        Gate::authorize('create', ManagementNote::class);

        $changes = $request->changes();
        $note = $create->handle($user, $changes['body'] ?? '', $changes['due_on'] ?? null);

        return response()->json(['note' => ManagementNotes::item($note, self::today())], 201);
    }

    public function update(ManagementNoteRequest $request, ManagementNote $managementNote, UpdateManagementNote $update): JsonResponse
    {
        Gate::authorize('update', $managementNote);

        $note = $update->handle($managementNote, $request->changes());

        return response()->json(['note' => ManagementNotes::item($note, self::today())]);
    }

    public function destroy(ManagementNote $managementNote, DeleteManagementNote $delete): JsonResponse
    {
        Gate::authorize('delete', $managementNote);

        $delete->handle($managementNote);

        return response()->json(null, 204);
    }

    public function reorder(Request $request, #[CurrentUser] User $user, ReorderManagementNotes $reorder): JsonResponse
    {
        Gate::authorize('create', ManagementNote::class);

        $validated = $request->validate([
            'ids' => ['present', 'array', 'max:'.ManagementNote::LIMIT],
            'ids.*' => ['required', 'string', 'ulid'],
        ]);

        /** @var list<string> $ids */
        $ids = array_values($validated['ids']);
        $reorder->handle($user, $ids);

        return response()->json(null, 204);
    }

    private static function today(): string
    {
        return Period::officeDate(now())->toDateString();
    }
}
