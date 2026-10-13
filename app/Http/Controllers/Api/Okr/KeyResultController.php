<?php

namespace App\Http\Controllers\Api\Okr;

use App\Domain\Okr\Actions\CreateKeyResult;
use App\Domain\Okr\Actions\DeleteKeyResult;
use App\Domain\Okr\Actions\RecordKeyResultCheckin;
use App\Domain\Okr\Actions\UpdateKeyResult;
use App\Domain\Okr\Queries\ObjectiveDetail;
use App\Domain\Requests\Support\OfficeTime;
use App\Http\Controllers\Controller;
use App\Http\Requests\Okr\CheckinRequest;
use App\Http\Requests\Okr\KeyResultRequest;
use App\Http\Resources\Api\Manajemen\OkrApi;
use App\Models\KeyResult;
use App\Models\Objective;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Key results of the Android app: detail (deep link of the Friday check-in
 * reminder), add, edit, remove, weekly check-in — the web Actions and
 * FormRequests (KeyResultRequest / CheckinRequest authorize through
 * KeyResultPolicy / ObjectivePolicy::createKeyResult; closed objective →
 * 403). Answers carry the key result as on the objective detail (with
 * check-ins, linked tasks, `can` and `progress`).
 */
class KeyResultController extends Controller
{
    public function __construct(private readonly ObjectiveDetail $detail) {}

    public function show(KeyResult $keyResult, #[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('view', $keyResult);

        return response()->json($this->present($keyResult->objective, $keyResult->id, $user));
    }

    public function store(KeyResultRequest $request, Objective $objective, #[CurrentUser] User $user, CreateKeyResult $create): JsonResponse
    {
        $keyResult = $create->handle($objective, $request->payload());

        return response()->json(['message' => 'Key result ditambahkan.', ...$this->present($objective, $keyResult->id, $user)], 201);
    }

    public function update(KeyResultRequest $request, KeyResult $keyResult, #[CurrentUser] User $user, UpdateKeyResult $update): JsonResponse
    {
        $update->handle($keyResult, $request->payload(), $user);

        return response()->json(['message' => 'Key result diperbarui.', ...$this->present($keyResult->objective, $keyResult->id, $user)]);
    }

    public function destroy(KeyResult $keyResult, DeleteKeyResult $delete): JsonResponse
    {
        Gate::authorize('delete', $keyResult);

        $delete->handle($keyResult);

        return response()->json(status: 204);
    }

    public function checkin(CheckinRequest $request, KeyResult $keyResult, #[CurrentUser] User $user, RecordKeyResultCheckin $record): JsonResponse
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

        return response()->json(['message' => 'Check-in tersimpan.', ...$this->present($keyResult->objective, $keyResult->id, $user)], 201);
    }

    /**
     * The key result as on GET /okr/{objective}, plus the objective's
     * header (progress, status, `can`) without the other key results.
     *
     * @return array{objective: array<string, mixed>, key_result: array<string, mixed>|null}
     */
    private function present(Objective $objective, string $keyResultId, User $user): array
    {
        $data = $this->detail->build($objective->fresh() ?? $objective, $user);
        /** @var array<string, mixed> $presented */
        $presented = OkrApi::objective($data['objective'], OfficeTime::today());
        /** @var list<array<string, mixed>> $keyResults */
        $keyResults = $presented['key_results'];
        $match = array_values(array_filter($keyResults, fn (array $kr): bool => $kr['id'] === $keyResultId))[0] ?? null;
        unset($presented['key_results']);

        return ['objective' => $presented, 'key_result' => $match];
    }
}
