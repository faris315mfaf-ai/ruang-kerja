<?php

namespace App\Http\Controllers\Briefings;

use App\Domain\Briefings\Actions\DelegateBriefing;
use App\Domain\Briefings\Actions\SaveBriefing;
use App\Http\Controllers\Controller;
use App\Http\Requests\Briefings\DelegateBriefingRequest;
use App\Http\Requests\Briefings\SaveBriefingRequest;
use App\Models\Briefing;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

/**
 * Briefing pagi & sore (keputusan pemilik 9 Okt 2026). The card itself
 * lives on the dashboards (DashboardController passes BriefingWindow::card
 * to viewers who may record); these endpoints save the minutes and appoint
 * a delegate for today + the chosen period.
 */
class BriefingController extends Controller
{
    public function store(SaveBriefingRequest $form, #[CurrentUser] User $user, SaveBriefing $save): RedirectResponse
    {
        Gate::authorize('create', Briefing::class);

        $briefing = $save->handle($user, $form->period(), $form->content());
        Inertia::flash('toast', [
            'type' => 'success',
            'message' => $briefing->wasRecentlyCreated
                ? 'Briefing tersimpan dan dikirim ke semua karyawan.'
                : 'Briefing diperbarui.',
        ]);

        return back();
    }

    public function delegate(DelegateBriefingRequest $form, #[CurrentUser] User $user, DelegateBriefing $delegate): RedirectResponse
    {
        Gate::authorize('delegate', Briefing::class);

        $target = User::query()->findOrFail($form->string('user_id')->toString());
        $delegate->handle($user, $target, $form->period());
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Delegasi pencatatan briefing disimpan.']);

        return back();
    }
}
