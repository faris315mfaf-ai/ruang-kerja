<?php

namespace App\Policies;

use App\Domain\Hiring\Enums\CandidateStage;
use App\Domain\Hiring\Services\HiringAccess;
use App\Models\Candidate;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Candidates (docs/fitur/hiring.md):
 * - HR & Super Admin: everything (stages, interview answers, checklist items).
 * - Interviewers of the position: view, their own points & checklist, notes.
 * - Final approvers of the position: view, all points, their own checklist,
 *   notes, and the final decision while the candidate is in "Keputusan akhir".
 * - Everyone else (other Kepala Divisi, members, other companies): 404.
 */
class CandidatePolicy
{
    public function __construct(private readonly HiringAccess $access) {}

    public function view(User $user, Candidate $candidate): Response
    {
        return $this->canView($user, $candidate) ? Response::allow() : Response::denyAsNotFound();
    }

    /** HR work: move stages, record answers, edit contact data, add/remove checklist items. */
    public function manage(User $user, Candidate $candidate): Response
    {
        if (! $this->canView($user, $candidate)) {
            return Response::denyAsNotFound();
        }

        return $this->access->isManager($user)
            ? Response::allow()
            : Response::deny('Hanya HR yang dapat melakukan ini.');
    }

    /** Give own points per interview question. */
    public function score(User $user, Candidate $candidate): Response
    {
        if (! $this->canView($user, $candidate)) {
            return Response::denyAsNotFound();
        }

        if (! $candidate->hiringPosition->isInterviewer($user)) {
            return Response::deny('Hanya pewawancara lowongan ini yang dapat memberi poin.');
        }

        return $candidate->stage->isFinal()
            ? Response::deny('Kandidat sudah diputus; poin tidak bisa diubah lagi.')
            : Response::allow();
    }

    /** Add interview minutes (notulensi). */
    public function note(User $user, Candidate $candidate): Response
    {
        return $this->view($user, $candidate);
    }

    /** Final decision (Setujui / Tolak). */
    public function decide(User $user, Candidate $candidate): Response
    {
        if (! $this->canView($user, $candidate)) {
            return Response::denyAsNotFound();
        }

        if (! $candidate->hiringPosition->isApprover($user)) {
            return Response::deny('Hanya penyetuju akhir lowongan ini yang dapat memutus.');
        }

        return $candidate->stage === CandidateStage::FinalReview
            ? Response::allow()
            : Response::deny('Kandidat belum berada di tahap Keputusan akhir.');
    }

    public function canView(User $user, Candidate $candidate): bool
    {
        if (! $user->isActive() || $candidate->company_id !== $user->company_id || $candidate->trashed()) {
            return false;
        }

        return $this->access->isManager($user) || $candidate->hiringPosition->isReviewer($user);
    }

    /** HR and final approvers see every interviewer's points; interviewers only their own. */
    public function canSeeAllScores(User $user, Candidate $candidate): bool
    {
        return $this->canView($user, $candidate)
            && ($this->access->isManager($user) || $candidate->hiringPosition->isApprover($user));
    }
}
