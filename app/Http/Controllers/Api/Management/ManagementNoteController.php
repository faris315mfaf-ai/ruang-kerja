<?php

namespace App\Http\Controllers\Api\Management;

use App\Domain\Analytics\Data\Period;
use App\Domain\Monitoring\Actions\CreateManagementNote;
use App\Domain\Monitoring\Actions\DeleteManagementNote;
use App\Domain\Monitoring\Actions\ReorderManagementNotes;
use App\Domain\Monitoring\Actions\UpdateManagementNote;
use App\Domain\Monitoring\Queries\ManagementNotes;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Manajemen\ManagementNoteMoveRequest;
use App\Http\Requests\Api\Manajemen\ManagementNoteOrderRequest;
use App\Http\Requests\Monitoring\ManagementNoteRequest;
use App\Models\ManagementNote;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/**
 * "Catatan tindakan" of the Android app (Dashboard Manajemen and the
 * monitoring tab "Catatan"): the web ManagementNoteController endpoints plus a
 * list and "Naikkan / Turunkan" (one place, saved through
 * ReorderManagementNotes). Personal: ManagementNotePolicy — creating needs
 * `dashboard.view_company`, anyone else's note is a 404 (even Super Admin).
 */
class ManagementNoteController extends Controller
{
    public function index(#[CurrentUser] User $user, ManagementNotes $notes): JsonResponse
    {
        Gate::authorize('viewAny', ManagementNote::class);

        return response()->json(['notes' => $notes->for($user, CarbonImmutable::now()), 'limit' => ManagementNote::LIMIT]);
    }

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

    public function move(ManagementNoteMoveRequest $request, ManagementNote $managementNote, #[CurrentUser] User $user, ReorderManagementNotes $reorder, ManagementNotes $notes): JsonResponse
    {
        Gate::authorize('update', $managementNote);

        if ($managementNote->isDone()) {
            throw ValidationException::withMessages(['arah' => 'Catatan yang sudah selesai tidak bisa diurutkan.']);
        }

        /** @var list<string> $ids */
        $ids = array_values(ManagementNote::query()->ownedBy($user)->whereNull('done_at')->orderBy('position')->orderBy('created_at')->pluck('id')->all());
        $index = array_search($managementNote->id, $ids, true);
        $target = $index === false ? false : ($request->up() ? $index - 1 : $index + 1);

        if ($index !== false && $target >= 0 && $target < count($ids)) {
            [$ids[$index], $ids[$target]] = [$ids[$target], $ids[$index]];
            $reorder->handle($user, array_values($ids));
        }

        return response()->json(['notes' => $notes->for($user, CarbonImmutable::now())]);
    }

    public function reorder(ManagementNoteOrderRequest $request, #[CurrentUser] User $user, ReorderManagementNotes $reorder): JsonResponse
    {
        Gate::authorize('create', ManagementNote::class);

        $reorder->handle($user, $request->ids());

        return response()->json(status: 204);
    }

    public function destroy(ManagementNote $managementNote, DeleteManagementNote $delete): JsonResponse
    {
        Gate::authorize('delete', $managementNote);

        $delete->handle($managementNote);

        return response()->json(status: 204);
    }

    private static function today(): string
    {
        return Period::officeDate(now())->toDateString();
    }
}
