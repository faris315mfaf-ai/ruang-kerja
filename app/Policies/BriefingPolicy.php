<?php

namespace App\Policies;

use App\Domain\Briefings\Services\BriefingRecorders;
use App\Domain\Briefings\Support\BriefingDay;
use App\Models\Briefing;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Briefing pagi & sore (keputusan pemilik 9 Okt 2026): every active employee
 * of the company reads the saved notes; HR & Super Admin record and
 * delegate; an appointed delegate records their date + period as if they
 * were the recorder. The recording window itself is enforced by
 * SaveBriefing (friendly validation error instead of a 403).
 */
class BriefingPolicy
{
    public function __construct(private readonly BriefingRecorders $recorders) {}

    public function viewAny(User $user): bool
    {
        return $user->isActive();
    }

    public function view(User $user, Briefing $briefing): Response
    {
        if (! $user->isActive() || $briefing->company_id !== $user->company_id) {
            return Response::denyAsNotFound();
        }

        return Response::allow();
    }

    /**
     * Coarse gate: HR / Super Admin, or an appointed delegate today. The
     * exact period, delegation target and window are re-checked by
     * SaveBriefing.
     */
    public function create(User $user): bool
    {
        return BriefingRecorders::isRecorder($user)
            || $this->recorders->isDelegateToday($user, BriefingDay::today());
    }

    /**
     * Appointing a delegate: HR & Super Admin only.
     */
    public function delegate(User $user): bool
    {
        return BriefingRecorders::isRecorder($user);
    }

    public function update(User $user, Briefing $briefing): bool
    {
        // Notes are re-saved through the same create flow (upsert), which
        // re-checks the window and the recorder/delegate rights.
        return false;
    }

    public function delete(User $user, Briefing $briefing): bool
    {
        return false;
    }
}
