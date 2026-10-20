<?php

namespace App\Http\Controllers\Hiring;

use App\Domain\Hiring\Actions\CreateCandidate;
use App\Domain\Hiring\Actions\MoveCandidateStage;
use App\Domain\Hiring\Actions\ScheduleInterview;
use App\Domain\Hiring\Actions\UpdateCandidate;
use App\Domain\Hiring\Enums\CandidateStage;
use App\Domain\Hiring\Queries\CandidateBoard;
use App\Domain\Hiring\Queries\CandidateProfile;
use App\Domain\Hiring\Queries\HiringOverview;
use App\Http\Controllers\Controller;
use App\Http\Requests\Hiring\CandidateRequest;
use App\Http\Requests\Hiring\InterviewScheduleRequest;
use App\Http\Requests\Hiring\StageRequest;
use App\Models\Candidate;
use App\Models\HiringPosition;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * /hiring (tab Kandidat: papan per tahap / daftar di ponsel), the candidate
 * profile, "Tambah kandidat manual", contact corrections and stage moves.
 */
class CandidateController extends Controller
{
    public function index(Request $request, #[CurrentUser] User $user, CandidateBoard $board, HiringOverview $overview): Response
    {
        Gate::authorize('viewAny', HiringPosition::class);

        $position = $request->query('lowongan');
        $search = $request->query('q');
        $data = $board->for($user, is_string($position) ? $position : null, is_string($search) ? $search : null);

        return Inertia::render('hiring/candidates', [
            'hiring' => $overview->for($user),
            'positions' => $data['positions'],
            'candidates' => $data['candidates'],
            'truncated' => $data['truncated'],
            'filters' => [
                'position' => is_string($position) && in_array($position, array_column($data['positions'], 'id'), true) ? $position : null,
                'q' => is_string($search) && trim($search) !== '' ? trim($search) : null,
            ],
        ]);
    }

    public function show(Request $request, Candidate $candidate, #[CurrentUser] User $user, CandidateProfile $profile, HiringOverview $overview): Response
    {
        Gate::authorize('view', $candidate);

        $tab = $request->query('tab');

        return Inertia::render('hiring/candidate', [
            'hiring' => $overview->for($user),
            ...$profile->for($candidate, $user),
            'initialTab' => is_string($tab) ? $tab : null,
        ]);
    }

    public function store(CandidateRequest $request, #[CurrentUser] User $user, CreateCandidate $create): RedirectResponse
    {
        $position = HiringPosition::query()->visibleTo($user)->find($request->string('position_id')->toString());
        abort_if($position === null, 404);
        Gate::authorize('update', $position);

        $candidate = $create->handle($user, $position, $request->payload());

        Inertia::flash('toast', ['type' => 'success', 'message' => "{$candidate->full_name} ditambahkan ke tahap Masuk."]);

        return redirect()->route('hiring.candidates.show', $candidate);
    }

    public function update(CandidateRequest $request, Candidate $candidate, #[CurrentUser] User $user, UpdateCandidate $update): RedirectResponse
    {
        Gate::authorize('manage', $candidate);

        $update->handle($user, $candidate, $request->payload());

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Data kandidat disimpan.']);

        return back();
    }

    public function stage(StageRequest $request, Candidate $candidate, #[CurrentUser] User $user, MoveCandidateStage $move): RedirectResponse
    {
        Gate::authorize('manage', $candidate);

        $target = CandidateStage::from($request->string('stage')->toString());
        $move->handle($user, $candidate, $target, $request->filled('reason') ? $request->string('reason')->toString() : null);

        Inertia::flash('toast', ['type' => 'success', 'message' => "{$candidate->full_name} dipindah ke {$target->label()}."]);

        return back();
    }

    /**
     * Jadwal wawancara (Ruang HR › Jadwal): set, move or clear.
     */
    public function interview(InterviewScheduleRequest $request, Candidate $candidate, #[CurrentUser] User $user, ScheduleInterview $schedule): RedirectResponse
    {
        Gate::authorize('manage', $candidate);

        $schedule->handle($user, $candidate, $request->scheduledAt(), $request->location());

        Inertia::flash('toast', ['type' => 'success', 'message' => $request->scheduledAt() === null
            ? "Jadwal wawancara {$candidate->full_name} dihapus."
            : "Wawancara {$candidate->full_name} dijadwalkan."]);

        return back();
    }
}
