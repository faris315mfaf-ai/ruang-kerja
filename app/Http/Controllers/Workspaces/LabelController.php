<?php

namespace App\Http\Controllers\Workspaces;

use App\Domain\Tasks\Actions\DeleteLabel;
use App\Domain\Tasks\Actions\SaveLabel;
use App\Http\Controllers\Controller;
use App\Http\Requests\Workspaces\LabelRequest;
use App\Models\Label;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

/**
 * Pengaturan › Label.
 */
class LabelController extends Controller
{
    public function store(LabelRequest $request, Workspace $workspace, SaveLabel $save): RedirectResponse
    {
        Gate::authorize('update', $workspace);

        $label = $save->handle($workspace, $request->string('name')->trim()->toString(), $request->string('color')->toString());
        Inertia::flash('toast', ['type' => 'success', 'message' => "Label {$label->name} ditambahkan."]);

        return back();
    }

    public function update(LabelRequest $request, Workspace $workspace, Label $label, SaveLabel $save): RedirectResponse
    {
        Gate::authorize('update', $label);

        $save->handle($workspace, $request->string('name')->trim()->toString(), $request->string('color')->toString(), $label);

        return back();
    }

    public function destroy(Workspace $workspace, Label $label, DeleteLabel $delete): RedirectResponse
    {
        Gate::authorize('delete', $label);

        $delete->handle($label);
        Inertia::flash('toast', ['type' => 'success', 'message' => "Label {$label->name} dihapus."]);

        return back();
    }
}
