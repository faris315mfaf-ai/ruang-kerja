<?php

namespace App\Http\Controllers\Automation;

use App\Domain\Automation\Actions\CreateTaskFromRecurring;
use App\Domain\Automation\Actions\DeleteRecurringTask;
use App\Domain\Automation\Actions\SaveRecurringTask;
use App\Domain\Automation\Actions\SetRecurringTaskActive;
use App\Domain\Automation\Queries\RecurringPage;
use App\Http\Controllers\Controller;
use App\Http\Requests\Automation\ActiveRequest;
use App\Http\Requests\Automation\RecurringTaskRequest;
use App\Models\RecurringTask;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * /otomasi/berulang — recurring tasks (F2-4).
 */
class RecurringTaskController extends Controller
{
    public function index(#[CurrentUser] User $user, RecurringPage $page): Response
    {
        Gate::authorize('viewAny', RecurringTask::class);

        return Inertia::render('automation/recurring', [
            'recurring' => $page->for($user, CarbonImmutable::now()),
        ]);
    }

    public function store(RecurringTaskRequest $request, #[CurrentUser] User $user, SaveRecurringTask $save): RedirectResponse
    {
        $workspace = $request->workspace();
        abort_if($workspace === null, 404);
        Gate::authorize('create', [RecurringTask::class, $workspace]);

        $save->handle($workspace, $user, $request->payload());

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Tugas berulang dibuat.']);

        return back();
    }

    public function update(RecurringTaskRequest $request, RecurringTask $recurring, #[CurrentUser] User $user, SaveRecurringTask $save): RedirectResponse
    {
        Gate::authorize('update', $recurring);
        $workspace = $request->workspace();
        abort_if($workspace === null, 404);

        if ($workspace->id !== $recurring->workspace_id) {
            Gate::authorize('create', [RecurringTask::class, $workspace]);
        }

        $save->handle($workspace, $user, $request->payload(), $recurring);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Tugas berulang diperbarui.']);

        return back();
    }

    public function active(ActiveRequest $request, RecurringTask $recurring, SetRecurringTaskActive $setActive): RedirectResponse
    {
        Gate::authorize('update', $recurring);

        $active = $request->boolean('is_active');
        $setActive->handle($recurring, $active);

        Inertia::flash('toast', ['type' => 'success', 'message' => $active ? 'Dilanjutkan.' : 'Dijeda. Tugas tidak dibuat sampai dilanjutkan.']);

        return back();
    }

    /** "Buat sekarang": an extra task due today. */
    public function run(RecurringTask $recurring, #[CurrentUser] User $user, CreateTaskFromRecurring $create): RedirectResponse
    {
        Gate::authorize('run', $recurring);

        $today = CarbonImmutable::now(config()->string('app.office_timezone'))->toDateString();
        $task = $create->handle($recurring, $today, $user);
        abort_if($task === null, 409, 'Workspace diarsipkan.');

        Inertia::flash('toast', ['type' => 'success', 'message' => "Tugas {$task->displayKey()} \"{$task->title}\" dibuat."]);

        return back();
    }

    public function destroy(RecurringTask $recurring, DeleteRecurringTask $delete): RedirectResponse
    {
        Gate::authorize('delete', $recurring);

        $delete->handle($recurring);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Dihapus. Tugas yang sudah dibuat tetap ada.']);

        return back();
    }
}
