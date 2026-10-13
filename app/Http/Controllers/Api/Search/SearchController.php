<?php

namespace App\Http\Controllers\Api\Search;

use App\Domain\Search\Actions\RunApiSearch;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\SearchApiRequest;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * GET /api/v1/cari — global search of the mobile app. Authorization is the
 * web `search` gate (active employees); the providers filter by the viewer's
 * visibility (personal workspaces, restricted notes and other people's
 * requests never leak).
 */
class SearchController extends Controller
{
    public function __invoke(SearchApiRequest $request, #[CurrentUser] User $user, RunApiSearch $search): JsonResponse
    {
        Gate::authorize('search');

        $term = $request->term();

        return response()->json([
            'q' => $term,
            'tipe' => $request->type(),
            // Words of the query so the app can highlight them in titles and snippets.
            'terms' => array_values(array_unique(preg_split('/\s+/u', mb_strtolower($term), -1, PREG_SPLIT_NO_EMPTY) ?: [])),
            'groups' => $search->handle($user, $term, $request->type()),
        ]);
    }
}
