<?php

namespace App\Http\Controllers\Hiring;

use App\Domain\Hiring\Actions\DecideCandidate;
use App\Domain\Hiring\Enums\CandidateStage;
use App\Domain\Hiring\Enums\DecisionValue;
use App\Http\Controllers\Controller;
use App\Http\Requests\Hiring\DecisionRequest;
use App\Models\Candidate;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

/** Final decision of an approver (Setujui / Tolak + catatan). */
class DecisionController extends Controller
{
    public function store(DecisionRequest $request, Candidate $candidate, #[CurrentUser] User $user, DecideCandidate $decide): RedirectResponse
    {
        Gate::authorize('decide', $candidate);

        $decision = DecisionValue::from($request->string('decision')->toString());
        $decide->handle($user, $candidate, $decision, $request->filled('note') ? $request->string('note')->toString() : null);

        $message = match ($candidate->stage) {
            CandidateStage::Hired => "Semua penyetuju setuju: {$candidate->full_name} diterima.",
            CandidateStage::Rejected => "{$candidate->full_name} ditolak.",
            default => 'Keputusan Anda dicatat. Menunggu penyetuju lain.',
        };

        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);

        return back();
    }
}
