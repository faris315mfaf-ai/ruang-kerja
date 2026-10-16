<?php

namespace App\Http\Controllers\Api\Hiring;

use App\Domain\Hiring\Actions\CreateHiringPosition;
use App\Domain\Hiring\Actions\UpdateHiringPosition;
use App\Domain\Hiring\Enums\PositionStatus;
use App\Domain\Hiring\Queries\HiringOverview;
use App\Domain\Hiring\Queries\PositionList;
use App\Http\Controllers\Controller;
use App\Http\Requests\Hiring\PositionRequest;
use App\Http\Resources\Api\Hiring\PositionDetail;
use App\Models\HiringPosition;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

/**
 * Hiring › Lowongan of the mobile app: the list for everyone in Hiring (web
 * PositionList: counts and the viewer's role per position), "Lowongan baru"
 * and the editable position settings for HR & Super Admin (owner decision
 * Bagian 5: everything except installing the Google Form script — the
 * webhook secret never reaches the phone and cannot be regenerated here).
 */
class PositionController extends Controller
{
    public function __construct(private readonly PositionDetail $detail) {}

    /**
     * GET /hiring/lowongan
     */
    public function index(#[CurrentUser] User $user, PositionList $positions, HiringOverview $overview): JsonResponse
    {
        Gate::authorize('viewAny', HiringPosition::class);

        $hiring = $overview->for($user);

        return response()->json([
            'hiring' => $hiring,
            'positions' => array_map(fn (array $position): array => [
                ...$position,
                'status_label' => PositionStatus::from($position['status'])->label(),
            ], $positions->for($user)),
            'divisions' => $hiring['can_manage'] ? PositionDetail::divisions($user) : [],
            'can' => ['create' => $hiring['can_manage']],
        ]);
    }

    /**
     * POST /hiring/lowongan {title, division_id?, description?} — created as Draf.
     */
    public function store(PositionRequest $request, #[CurrentUser] User $user, CreateHiringPosition $create): JsonResponse
    {
        Gate::authorize('create', HiringPosition::class);

        $position = $create->handle($user, [
            'title' => $request->string('title')->toString(),
            'division_id' => $request->filled('division_id') ? $request->string('division_id')->toString() : null,
            'description' => $request->filled('description') ? $request->string('description')->toString() : null,
        ]);

        return response()->json([
            'message' => 'Lowongan dibuat sebagai draf. Lengkapi pengaturannya.',
            ...$this->detail->make($position, $user),
        ], 201);
    }

    /**
     * GET /hiring/lowongan/{position} — settings (HR & Super Admin).
     */
    public function show(HiringPosition $position, #[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('update', $position);

        return response()->json($this->detail->make($position, $user));
    }

    /**
     * PUT /hiring/lowongan/{position} — the whole settings form.
     */
    public function update(PositionRequest $request, HiringPosition $position, #[CurrentUser] User $user, UpdateHiringPosition $update): JsonResponse
    {
        Gate::authorize('update', $position);

        $update->handle($user, $position, [
            'title' => $request->string('title')->toString(),
            'division_id' => $request->filled('division_id') ? $request->string('division_id')->toString() : null,
            'description' => $request->filled('description') ? $request->string('description')->toString() : null,
            'status' => PositionStatus::from($request->string('status')->toString()),
            'interviewer_ids' => $request->ids('interviewer_ids'),
            'final_approver_ids' => $request->ids('final_approver_ids'),
            'field_map' => $request->fieldMap(),
        ]);

        return response()->json([
            'message' => 'Pengaturan lowongan disimpan.',
            ...$this->detail->make($position, $user),
        ]);
    }

    /**
     * DELETE /hiring/lowongan/{position} — only while it never had a candidate.
     */
    public function destroy(HiringPosition $position): JsonResponse|Response
    {
        Gate::authorize('delete', $position);

        if ($position->candidates()->withTrashed()->exists()) {
            return response()->json([
                'message' => 'Lowongan yang sudah punya kandidat tidak bisa dihapus. Tutup saja lowongannya.',
                'code' => 'punya_kandidat',
                'errors' => ['position' => ['Lowongan yang sudah punya kandidat tidak bisa dihapus. Tutup saja lowongannya.']],
            ], 422);
        }

        $position->delete();

        return response()->noContent();
    }
}
