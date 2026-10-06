<?php

namespace App\Http\Controllers\Hiring;

use App\Domain\Hiring\Actions\SaveHiringSettings;
use App\Domain\Hiring\Queries\HiringOverview;
use App\Domain\Hiring\Queries\HiringPeople;
use App\Http\Controllers\Controller;
use App\Http\Requests\Hiring\SettingsRequest;
use App\Models\HiringSetting;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/** Tab Pengaturan (HR): default final approvers + checklist template. */
class SettingsController extends Controller
{
    public function edit(#[CurrentUser] User $user, HiringOverview $overview, HiringPeople $people): Response
    {
        Gate::authorize('view', HiringSetting::class);

        $setting = HiringSetting::forCompany($user->company_id);

        return Inertia::render('hiring/settings', [
            'hiring' => $overview->for($user),
            'settings' => [
                'default_final_approver_ids' => $setting->default_final_approver_ids,
                'checklist_template' => $setting->template(),
            ],
            'employees' => $people->options($user->company_id),
        ]);
    }

    public function update(SettingsRequest $request, #[CurrentUser] User $user, SaveHiringSettings $save): RedirectResponse
    {
        Gate::authorize('update', HiringSetting::class);

        $save->handle($user, [
            'default_final_approver_ids' => $request->approverIds(),
            'checklist_template' => $request->template(),
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Pengaturan hiring disimpan.']);

        return back();
    }
}
