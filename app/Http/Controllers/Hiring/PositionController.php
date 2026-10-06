<?php

namespace App\Http\Controllers\Hiring;

use App\Domain\Hiring\Actions\CreateHiringPosition;
use App\Domain\Hiring\Actions\RegenerateWebhookCredentials;
use App\Domain\Hiring\Actions\UpdateHiringPosition;
use App\Domain\Hiring\Enums\PositionStatus;
use App\Domain\Hiring\Queries\HiringOverview;
use App\Domain\Hiring\Queries\HiringPeople;
use App\Domain\Hiring\Queries\PositionList;
use App\Domain\Hiring\Services\HiringAccess;
use App\Http\Controllers\Controller;
use App\Http\Requests\Hiring\PositionRequest;
use App\Models\Division;
use App\Models\HiringPosition;
use App\Models\HiringQuestion;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Tab Lowongan (list for everyone in Hiring, create for HR) and the position
 * settings page (HR): details, reviewers, questions, webhook, field mapping.
 */
class PositionController extends Controller
{
    public function index(#[CurrentUser] User $user, PositionList $positions, HiringOverview $overview, HiringAccess $access): Response
    {
        Gate::authorize('viewAny', HiringPosition::class);

        return Inertia::render('hiring/positions', [
            'hiring' => $overview->for($user),
            'positions' => $positions->for($user),
            'divisions' => fn (): array => $access->isManager($user) ? $this->divisions($user) : [],
        ]);
    }

    public function store(PositionRequest $request, #[CurrentUser] User $user, CreateHiringPosition $create): RedirectResponse
    {
        Gate::authorize('create', HiringPosition::class);

        $position = $create->handle($user, [
            'title' => $request->string('title')->toString(),
            'division_id' => $request->filled('division_id') ? $request->string('division_id')->toString() : null,
            'description' => $request->filled('description') ? $request->string('description')->toString() : null,
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Lowongan dibuat sebagai draf. Lengkapi pengaturannya.']);

        return redirect()->route('hiring.positions.edit', $position);
    }

    public function edit(HiringPosition $position, #[CurrentUser] User $user, HiringOverview $overview, HiringPeople $people): Response
    {
        Gate::authorize('update', $position);

        $position->load(['questions' => fn ($query) => $query->withExists(['answers', 'scores'])]);

        return Inertia::render('hiring/position-settings', [
            'hiring' => $overview->for($user),
            'position' => [
                'id' => $position->id,
                'title' => $position->title,
                'division_id' => $position->division_id,
                'description' => $position->description,
                'status' => $position->status->value,
                'interviewer_ids' => $position->interviewer_ids,
                'final_approver_ids' => $position->final_approver_ids,
                'field_map' => (object) $position->field_map,
                'webhook_url' => $position->webhookUrl(),
                'candidates_count' => $position->candidates()->count(),
            ],
            'questions' => array_values($position->questions->map(fn (HiringQuestion $question): array => [
                'id' => $question->id,
                'prompt' => $question->prompt,
                'guidance' => $question->guidance,
                'max_score' => $question->max_score,
                'locked' => (bool) $question->getAttribute('answers_exists') || (bool) $question->getAttribute('scores_exists'),
            ])->all()),
            'employees' => $people->options($user->company_id),
            'divisions' => $this->divisions($user),
        ]);
    }

    public function update(PositionRequest $request, HiringPosition $position, #[CurrentUser] User $user, UpdateHiringPosition $update): RedirectResponse
    {
        Gate::authorize('update', $position);

        $update->handle($user, $position, [
            'title' => $request->string('title')->toString(),
            'division_id' => $request->filled('division_id') ? $request->string('division_id')->toString() : null,
            'description' => $request->filled('description') ? $request->string('description')->toString() : null,
            'status' => PositionStatus::from($request->string('status')->toString()),
            'interviewer_ids' => $request->ids('interviewer_ids'),
            'final_approver_ids' => $request->ids('final_approver_ids'),
            'field_map' => $request->fieldMap(),
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Pengaturan lowongan disimpan.']);

        return back();
    }

    public function destroy(HiringPosition $position, #[CurrentUser] User $user): RedirectResponse
    {
        Gate::authorize('delete', $position);

        if ($position->candidates()->withTrashed()->exists()) {
            Inertia::flash('toast', ['type' => 'error', 'message' => 'Lowongan yang sudah punya kandidat tidak bisa dihapus. Tutup saja lowongannya.']);

            return back();
        }

        $position->delete();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Lowongan dihapus.']);

        return redirect()->route('hiring.positions.index');
    }

    /** "Buat ulang tautan & secret": the new secret is returned once. */
    public function regenerate(HiringPosition $position, #[CurrentUser] User $user, RegenerateWebhookCredentials $regenerate): JsonResponse
    {
        Gate::authorize('update', $position);

        return response()->json($regenerate->handle($user, $position));
    }

    /**
     * @return list<array{id: string, name: string}>
     */
    private function divisions(User $user): array
    {
        return array_values(Division::query()
            ->where('company_id', $user->company_id)
            ->where('is_board', false)
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Division $division): array => ['id' => $division->id, 'name' => $division->name])
            ->all());
    }
}
