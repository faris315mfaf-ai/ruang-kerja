<?php

namespace App\Http\Controllers\Api\Okr;

use App\Domain\Analytics\Okr\Quarter;
use App\Domain\Okr\Actions\CloseObjective;
use App\Domain\Okr\Actions\CreateObjective;
use App\Domain\Okr\Actions\UpdateObjective;
use App\Domain\Okr\Queries\ObjectiveDetail;
use App\Domain\Okr\Queries\OkrIndex;
use App\Domain\Requests\Support\OfficeTime;
use App\Http\Controllers\Controller;
use App\Http\Requests\Okr\ObjectiveRequest;
use App\Http\Resources\Api\Manajemen\OkrApi;
use App\Models\Objective;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * OKR divisi of the Android app (Bagian 5 / B5-A, behind FEATURE_OKR like
 * the web: 404 while off). The web OkrIndex / ObjectiveDetail props with the
 * computed progress (OkrApi), and the web Actions, ObjectiveRequest (which
 * authorizes: create = Kepala Divisi of the division or Direksi) and
 * ObjectivePolicy (invisible objective → 404).
 */
class ObjectiveController extends Controller
{
    public function index(Request $request, #[CurrentUser] User $user, OkrIndex $index): JsonResponse
    {
        Gate::authorize('viewAny', Objective::class);

        $division = $request->query('divisi');
        $data = $index->build(
            $user,
            Quarter::tryParse($request->query('kuartal')),
            is_string($division) && strlen($division) === 26 ? strtolower($division) : null,
        );

        $today = OfficeTime::today();
        /** @var array{quarter: string} $filters */
        $filters = $data['filters'];
        $quarter = Quarter::parse($filters['quarter']);
        /** @var list<array<string, mixed>> $objectives */
        $objectives = $data['objectives'];
        $objectives = array_map(fn (array $objective): array => OkrApi::objective($objective, $today), $objectives);

        return response()->json([
            ...$data,
            'quarter' => OkrApi::quarter($quarter, $today),
            'objectives' => $objectives,
            'kpis' => OkrApi::kpis($objectives, $quarter, $today),
            'can' => ['create' => $data['create'] !== null],
        ]);
    }

    public function show(Objective $objective, #[CurrentUser] User $user, ObjectiveDetail $detail): JsonResponse
    {
        Gate::authorize('view', $objective);

        return response()->json($this->detail($objective, $user, $detail));
    }

    public function store(ObjectiveRequest $request, #[CurrentUser] User $user, CreateObjective $create, ObjectiveDetail $detail): JsonResponse
    {
        $division = $request->division();
        abort_if($division === null, 404);

        $objective = $create->handle($division, $request->payload());

        return response()->json([
            'message' => 'Objective dibuat. Tambahkan key result-nya.',
            ...$this->detail($objective, $user, $detail),
        ], 201);
    }

    /**
     * Edit; on a closed objective this reopens it ("Buka kembali") like the web.
     */
    public function update(ObjectiveRequest $request, Objective $objective, #[CurrentUser] User $user, UpdateObjective $update, ObjectiveDetail $detail): JsonResponse
    {
        $wasClosed = $objective->isClosed();
        $objective = $update->handle($objective, $request->payload());

        return response()->json([
            'message' => $wasClosed ? 'Objective dibuka kembali.' : 'Objective disimpan.',
            ...$this->detail($objective, $user, $detail),
        ]);
    }

    public function close(Objective $objective, #[CurrentUser] User $user, CloseObjective $close, ObjectiveDetail $detail): JsonResponse
    {
        Gate::authorize('close', $objective);

        $objective = $close->handle($objective);

        return response()->json([
            'message' => 'Objective ditutup.',
            ...$this->detail($objective, $user, $detail),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function detail(Objective $objective, User $user, ObjectiveDetail $detail): array
    {
        $data = $detail->build($objective->fresh() ?? $objective, $user);
        $today = OfficeTime::today();
        /** @var array<string, mixed> $presented */
        $presented = $data['objective'];
        $quarter = Quarter::tryParse($presented['quarter'] ?? null) ?? Quarter::of($today);

        return [
            ...$data,
            'objective' => OkrApi::objective($presented, $today),
            'quarter' => OkrApi::quarter($quarter, $today),
        ];
    }
}
