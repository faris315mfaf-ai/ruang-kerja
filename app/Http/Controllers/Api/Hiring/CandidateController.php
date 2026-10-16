<?php

namespace App\Http\Controllers\Api\Hiring;

use App\Domain\Hiring\Actions\CreateCandidate;
use App\Domain\Hiring\Actions\MoveCandidateStage;
use App\Domain\Hiring\Actions\UpdateCandidate;
use App\Domain\Hiring\Enums\CandidateStage;
use App\Domain\Hiring\Queries\CandidateBoard;
use App\Domain\Hiring\Queries\HiringOverview;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Hiring\CandidateBoardRequest;
use App\Http\Requests\Hiring\CandidateRequest;
use App\Http\Requests\Hiring\StageRequest;
use App\Http\Resources\Api\Hiring\CandidateDetail;
use App\Models\Candidate;
use App\Models\HiringPosition;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Hiring › Kandidat of the mobile app (B5-H): stage chips + cards (web
 * CandidateBoard), the candidate profile (web CandidateProfile through
 * CandidateDetail), "Tambah kandidat manual", "Ubah data" and "Pindahkan…"
 * (also Ditolak with a reason and reopening a decided candidate). Thin over
 * CreateCandidate / UpdateCandidate / MoveCandidateStage and the Hiring
 * policies; invisible candidates and positions answer 404.
 */
class CandidateController extends Controller
{
    public function __construct(private readonly CandidateDetail $detail) {}

    /**
     * GET /hiring/kandidat?lowongan=&q=&tahap=
     */
    public function index(CandidateBoardRequest $request, #[CurrentUser] User $user, CandidateBoard $board, HiringOverview $overview): JsonResponse
    {
        Gate::authorize('viewAny', HiringPosition::class);

        $data = $board->for($user, $request->position(), $request->search());
        $stage = $request->stage();
        $hiring = $overview->for($user);

        $counts = array_count_values(array_column($data['candidates'], 'stage'));
        $candidates = $stage === null
            ? $data['candidates']
            : array_values(array_filter($data['candidates'], fn (array $card): bool => $card['stage'] === $stage->value));

        $position = $request->position();

        return response()->json([
            'hiring' => $hiring,
            'positions' => $data['positions'],
            'stages' => array_map(fn (CandidateStage $case): array => [
                'value' => $case->value,
                'label' => $case->label(),
                'count' => $counts[$case->value] ?? 0,
            ], CandidateStage::cases()),
            'candidates' => array_map(fn (array $card): array => [
                ...$card,
                'stage_label' => CandidateStage::from($card['stage'])->label(),
            ], $candidates),
            'truncated' => $data['truncated'],
            'filters' => [
                'position' => $position !== null && in_array($position, array_column($data['positions'], 'id'), true) ? $position : null,
                'q' => $request->search(),
                'stage' => $stage?->value,
            ],
            'can' => [
                'manage' => $hiring['can_manage'],
                'create_candidate' => $hiring['can_manage'] && $data['positions'] !== [],
                'move' => $hiring['can_manage'],
            ],
        ]);
    }

    /**
     * GET /hiring/kandidat/{candidate}
     */
    public function show(Candidate $candidate, #[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('view', $candidate);

        return response()->json(['candidate' => $this->detail->make($candidate, $user)]);
    }

    /**
     * POST /hiring/kandidat {position_id, full_name, email?, phone?, cv_url?}
     */
    public function store(CandidateRequest $request, #[CurrentUser] User $user, CreateCandidate $create): JsonResponse
    {
        $position = HiringPosition::query()->visibleTo($user)->find($request->string('position_id')->toString());
        abort_if($position === null, 404);
        Gate::authorize('update', $position);

        $candidate = $create->handle($user, $position, $request->payload());

        return response()->json([
            'message' => "{$candidate->full_name} ditambahkan ke tahap Masuk.",
            'candidate' => $this->detail->make($candidate, $user),
        ], 201);
    }

    /**
     * PATCH /hiring/kandidat/{candidate} {full_name, email?, phone?, cv_url?}
     */
    public function update(CandidateRequest $request, Candidate $candidate, #[CurrentUser] User $user, UpdateCandidate $update): JsonResponse
    {
        Gate::authorize('manage', $candidate);

        $update->handle($user, $candidate, $request->payload());

        return response()->json([
            'message' => 'Data kandidat disimpan.',
            'candidate' => $this->detail->make($candidate, $user),
        ]);
    }

    /**
     * PUT /hiring/kandidat/{candidate}/tahap {stage, reason?}
     */
    public function stage(StageRequest $request, Candidate $candidate, #[CurrentUser] User $user, MoveCandidateStage $move): JsonResponse
    {
        Gate::authorize('manage', $candidate);

        $from = $candidate->stage;
        $target = CandidateStage::from($request->string('stage')->toString());
        $move->handle($user, $candidate, $target, $request->filled('reason') ? $request->string('reason')->toString() : null);

        return response()->json([
            'message' => "{$candidate->full_name} dipindah ke {$target->label()}.",
            'previous_stage' => $from->value,
            'candidate' => $this->detail->make($candidate, $user),
        ]);
    }
}
