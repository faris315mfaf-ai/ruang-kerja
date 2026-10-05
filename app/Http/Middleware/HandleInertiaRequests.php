<?php

namespace App\Http\Middleware;

use App\Domain\Notifications\Services\InboxQuery;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();
        $user = $user instanceof User ? $user : null;

        // Small PK lookups; gives the shell the user's place in the organization.
        $user?->loadMissing(['company:id,name', 'division:id,name,code', 'position:id,name,level']);

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'branding' => [
                'name' => config('branding.name', config('app.name')),
                'companyName' => $user !== null ? $user->company->name : config('branding.company_name'),
                'shortName' => config('branding.short_name', 'RK'),
                'logo' => config('branding.logo'),
            ],
            'auth' => [
                'user' => $user === null ? null : [
                    // Attributes only: relations loaded elsewhere (roles, permissions) never leak.
                    ...$user->attributesToArray(),
                    'avatar' => $user->avatar_url,
                    'company' => $user->company->only(['id', 'name']),
                    'division' => $user->division?->only(['id', 'name', 'code']),
                    'position' => $user->position?->only(['id', 'name', 'level']),
                ],
                'roles' => $user?->getRoleNames()->values()->all() ?? [],
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            // Bell / sidebar / tab badge. Closure: skipped on partial reloads that don't ask for it.
            'inbox' => fn (): ?array => $user !== null ? ['unread' => app(InboxQuery::class)->unreadCount($user)] : null,
        ];
    }
}
