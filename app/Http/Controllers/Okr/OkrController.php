<?php

namespace App\Http\Controllers\Okr;

use App\Domain\Analytics\Okr\Quarter;
use App\Domain\Okr\Actions\CloseObjective;
use App\Domain\Okr\Actions\CreateObjective;
use App\Domain\Okr\Actions\UpdateObjective;
use App\Domain\Okr\Queries\ObjectiveDetail;
use App\Domain\Okr\Queries\OkrIndex;
use App\Http\Controllers\Controller;
use App\Http\Requests\Okr\ObjectiveRequest;
use App\Models\Objective;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * OKR divisi (F3-3, docs/fitur/okr.md): /okr list (filters `kuartal`,
 * `divisi` in the query string), /okr/{objective} detail, create / edit /
 * close an objective. Authorization: ObjectivePolicy (FormRequest for
 * writes; invisible → 404).
 */
class OkrController extends Controller
{
    public function index(Request $request, #[CurrentUser] User $user, OkrIndex $index): Response
    {
        Gate::authorize('viewAny', Objective::class);

        $division = $request->query('divisi');

        return Inertia::render('okr/index', $index->build(
            $user,
            Quarter::tryParse($request->query('kuartal')),
            is_string($division) && strlen($division) === 26 ? strtolower($division) : null,
        ));
    }

    public function show(Objective $objective, #[CurrentUser] User $user, ObjectiveDetail $detail): Response
    {
        Gate::authorize('view', $objective);

        return Inertia::render('okr/show', $detail->build($objective, $user));
    }

    public function store(ObjectiveRequest $request, CreateObjective $create): RedirectResponse
    {
        $division = $request->division();
        abort_if($division === null, 404);

        $objective = $create->handle($division, $request->payload());
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Objective dibuat. Tambahkan key result-nya.']);

        return to_route('okr.show', $objective);
    }

    public function update(ObjectiveRequest $request, Objective $objective, UpdateObjective $update): RedirectResponse
    {
        $wasClosed = $objective->isClosed();
        $update->handle($objective, $request->payload());

        return $this->done($wasClosed ? 'Objective dibuka kembali.' : 'Objective disimpan.');
    }

    public function close(Objective $objective, CloseObjective $close): RedirectResponse
    {
        Gate::authorize('close', $objective);

        $close->handle($objective);

        return $this->done('Objective ditutup.');
    }

    private function done(string $message): RedirectResponse
    {
        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);

        return back();
    }
}
