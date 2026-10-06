<?php

namespace App\Http\Controllers\Automation;

use App\Domain\Automation\Actions\DeleteAutomationRule;
use App\Domain\Automation\Actions\DuplicateAutomationRule;
use App\Domain\Automation\Actions\SaveAutomationRule;
use App\Domain\Automation\Actions\SetAutomationRuleActive;
use App\Domain\Automation\Queries\AutomationPage;
use App\Http\Controllers\Controller;
use App\Http\Requests\Automation\ActiveRequest;
use App\Http\Requests\Automation\AutomationRuleRequest;
use App\Models\AutomationRule;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * /otomasi — automation rules "jika … maka …" (F2-4). Mutations answer with
 * a redirect back + toast; the page reloads its `automation` prop.
 */
class AutomationRuleController extends Controller
{
    public function index(#[CurrentUser] User $user, AutomationPage $page): Response
    {
        Gate::authorize('viewAny', AutomationRule::class);

        return Inertia::render('automation/rules', [
            'automation' => $page->for($user, CarbonImmutable::now()),
        ]);
    }

    public function store(AutomationRuleRequest $request, #[CurrentUser] User $user, SaveAutomationRule $save): RedirectResponse
    {
        $workspace = $request->workspace();
        abort_if($workspace === null, 404);
        Gate::authorize('create', [AutomationRule::class, $workspace]);

        $rule = $save->handle($workspace, $user, $request->payload());

        Inertia::flash('toast', ['type' => 'success', 'message' => "Aturan \"{$rule->name}\" disimpan dan aktif."]);

        return back();
    }

    public function update(AutomationRuleRequest $request, AutomationRule $rule, #[CurrentUser] User $user, SaveAutomationRule $save): RedirectResponse
    {
        Gate::authorize('update', $rule);
        $workspace = $request->workspace();
        abort_if($workspace === null, 404);

        if ($workspace->id !== $rule->workspace_id) {
            Gate::authorize('create', [AutomationRule::class, $workspace]);
        }

        $save->handle($workspace, $user, $request->payload(), $rule);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Aturan diperbarui.']);

        return back();
    }

    public function active(ActiveRequest $request, AutomationRule $rule, SetAutomationRuleActive $setActive): RedirectResponse
    {
        Gate::authorize('update', $rule);

        $active = $request->boolean('is_active');
        $setActive->handle($rule, $active);

        Inertia::flash('toast', ['type' => 'success', 'message' => $active ? "\"{$rule->name}\" aktif." : "\"{$rule->name}\" dijeda."]);

        return back();
    }

    public function duplicate(AutomationRule $rule, #[CurrentUser] User $user, DuplicateAutomationRule $duplicate): RedirectResponse
    {
        Gate::authorize('update', $rule);

        $duplicate->handle($rule, $user);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Salinan dibuat (dijeda).']);

        return back();
    }

    public function destroy(AutomationRule $rule, DeleteAutomationRule $delete): RedirectResponse
    {
        Gate::authorize('delete', $rule);

        $delete->handle($rule);

        Inertia::flash('toast', ['type' => 'success', 'message' => "\"{$rule->name}\" dihapus."]);

        return back();
    }
}
