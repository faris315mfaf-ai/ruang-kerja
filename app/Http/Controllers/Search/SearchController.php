<?php

namespace App\Http\Controllers\Search;

use App\Domain\Search\Actions\RunSearch;
use App\Domain\Search\Services\SearchRegistry;
use App\Http\Controllers\Controller;
use App\Http\Requests\Search\SearchRequest;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Global search. Authorization: signed-in employees only (route middleware);
 * every SearchProvider filters by the viewer's visibility.
 */
class SearchController extends Controller
{
    /**
     * Mobile search screen (/cari); desktop uses the command palette.
     */
    public function index(SearchRequest $request, SearchRegistry $registry): Response
    {
        return Inertia::render('search/index', [
            'q' => $request->term(),
            'groups' => array_map(fn ($provider): array => [
                'key' => $provider->key(),
                'label' => $provider->label(),
            ], $registry->all()),
        ]);
    }

    public function results(SearchRequest $request, #[CurrentUser] User $user, RunSearch $search): JsonResponse
    {
        return response()->json([
            'q' => $request->term(),
            'groups' => $search->handle($user, $request->term(), $request->group()),
        ]);
    }
}
