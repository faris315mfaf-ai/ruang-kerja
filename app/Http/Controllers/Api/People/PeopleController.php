<?php

namespace App\Http\Controllers\Api\People;

use App\Domain\Search\Support\LikePattern;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * GET /api/v1/orang?q= — people picker of the Android app (briefing
 * delegation, announcement and form pickers). Same scope as the web "Orang"
 * search (PeopleSearchProvider): active colleagues limited to
 * User::visibleTo($viewer) — company-scoped, everyone for `employees.view`
 * (HR, Direksi, Super Admin), otherwise self + direct reports + led
 * divisions — matched on name or email. At most 20 rows; the email is only
 * used for matching and never returned.
 */
class PeopleController extends Controller
{
    public const int LIMIT = 20;

    public function __invoke(Request $request, #[CurrentUser] User $viewer): JsonResponse
    {
        $request->validate(['q' => ['nullable', 'string', 'max:100']], [
            'q.max' => 'Kata kunci maksimal :max karakter.',
        ]);

        $term = trim($request->string('q')->toString());

        $people = User::query()
            ->visibleTo($viewer)
            ->active()
            ->when($term !== '', function (Builder $query) use ($term): void {
                $pattern = LikePattern::contains($term);
                $query->where(fn (Builder $match) => $match
                    ->where('users.name', 'ilike', $pattern)
                    ->orWhere('users.email', 'ilike', $pattern));
            })
            ->with(['division:id,name', 'position:id,name'])
            ->orderBy('users.name')
            ->orderBy('users.id')
            ->limit(self::LIMIT)
            ->get(['users.id', 'users.name', 'users.avatar_url', 'users.division_id', 'users.position_id']);

        return response()->json([
            'orang' => $people->map(fn (User $user): array => [
                'id' => $user->id,
                'name' => $user->name,
                'initials' => self::initials($user->name),
                'avatar' => $user->avatar_url,
                'position' => $user->position?->name,
                'division' => $user->division?->name,
            ])->values()->all(),
        ]);
    }

    private static function initials(string $name): string
    {
        $words = array_values(array_filter(preg_split('/\s+/u', trim($name)) ?: []));

        return mb_strtoupper(implode('', array_map(
            fn (string $word): string => Str::substr($word, 0, 1),
            array_slice($words, 0, 2),
        )));
    }
}
