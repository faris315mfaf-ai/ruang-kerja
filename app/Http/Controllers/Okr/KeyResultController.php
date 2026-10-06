<?php

namespace App\Http\Controllers\Okr;

use App\Domain\Okr\Actions\CreateKeyResult;
use App\Domain\Okr\Actions\DeleteKeyResult;
use App\Domain\Okr\Actions\RecordKeyResultCheckin;
use App\Domain\Okr\Actions\UpdateKeyResult;
use App\Http\Controllers\Controller;
use App\Http\Requests\Okr\CheckinRequest;
use App\Http\Requests\Okr\KeyResultRequest;
use App\Models\KeyResult;
use App\Models\Objective;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

/**
 * Key results of an objective: add, edit, remove, weekly check-in
 * (KeyResultPolicy / ObjectivePolicy::createKeyResult; FormRequests
 * authorize before validating). Responses go back to the detail page,
 * which reloads its props.
 */
class KeyResultController extends Controller
{
    public function store(KeyResultRequest $request, Objective $objective, CreateKeyResult $create): RedirectResponse
    {
        $create->handle($objective, $request->payload());

        return $this->done('Key result ditambahkan.');
    }

    public function update(KeyResultRequest $request, KeyResult $keyResult, #[CurrentUser] User $user, UpdateKeyResult $update): RedirectResponse
    {
        $update->handle($keyResult, $request->payload(), $user);

        return $this->done('Key result diperbarui.');
    }

    public function destroy(KeyResult $keyResult, DeleteKeyResult $delete): RedirectResponse
    {
        Gate::authorize('delete', $keyResult);

        $delete->handle($keyResult);

        return $this->done('Key result dihapus.');
    }

    public function checkin(CheckinRequest $request, KeyResult $keyResult, #[CurrentUser] User $user, RecordKeyResultCheckin $record): RedirectResponse
    {
        $confidence = $request->input('confidence');
        $note = $request->input('note');

        $record->handle(
            $keyResult,
            $user,
            $request->float('value'),
            is_numeric($confidence) ? (int) $confidence : null,
            is_string($note) ? $note : null,
        );

        return $this->done('Check-in tersimpan.');
    }

    private function done(string $message): RedirectResponse
    {
        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);

        return back();
    }
}
