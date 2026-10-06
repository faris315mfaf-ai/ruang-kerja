<?php

namespace App\Http\Middleware;

use App\Domain\Chat\Queries\ChatInbox;
use App\Domain\Notifications\Services\InboxQuery;
use App\Domain\Organization\Demo\DemoAccounts;
use App\Domain\Requests\Services\ApprovalQueue;
use App\Domain\Workspaces\Queries\SidebarWorkspaces;
use App\Http\Resources\Attendance\MyAttendance;
use App\Models\Company;
use App\Models\Division;
use App\Models\Position;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Middleware;
use Inertia\OnceProp;

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
        // Separate queries on purpose: loading partial columns into the user's own
        // relations would leak into controllers/actions (e.g. company.google_domain).
        $company = $user !== null ? Company::query()->whereKey($user->company_id)->first(['id', 'name']) : null;
        $division = $user?->division_id !== null ? Division::query()->whereKey($user->division_id)->first(['id', 'name', 'code']) : null;
        $position = $user?->position_id !== null ? Position::query()->whereKey($user->position_id)->first(['id', 'name', 'level']) : null;

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'branding' => [
                'name' => config('branding.name', config('app.name')),
                'companyName' => $company !== null ? $company->name : config('branding.company_name'),
                'shortName' => config('branding.short_name', 'RK'),
                'logo' => config('branding.logo'),
            ],
            'auth' => [
                'user' => $user === null ? null : [
                    // Attributes only: relations loaded elsewhere (roles, permissions) never leak.
                    ...$user->attributesToArray(),
                    'avatar' => $user->avatar_url,
                    'company' => $company?->only(['id', 'name']),
                    'division' => $division?->only(['id', 'name', 'code']),
                    'position' => $position?->only(['id', 'name', 'level']),
                ],
                'roles' => $user?->getRoleNames()->values()->all() ?? [],
            ],
            // Dock/Rail "Persetujuan" badge. Closure: one count query, skipped on partial reloads that don't ask for it.
            'approvals' => fn (): ?array => $user !== null ? ['pending' => app(ApprovalQueue::class)->count($user)] : null,
            // Dock/Rail "Workspace" stack & mobile Menu grid (Sprint 5); lazy, skipped on partial reloads.
            'workspaces' => fn (): array => $user === null ? [] : app(SidebarWorkspaces::class)->for($user),
            // Bell / Dock / tab badge. Closure: skipped on partial reloads that don't ask for it.
            'inbox' => fn (): ?array => $user !== null ? ['unread' => app(InboxQuery::class)->unreadCount($user)] : null,
            // Fase 2 & 3 front-end previews (/pratinjau, config/features.php).
            'features' => ['prototype' => (bool) config('features.prototype'), 'chat' => (bool) config('features.chat'), 'notes' => (bool) config('features.notes')],
            // Obrolan (F2-1): channels with unread messages (Dock tile / Menu badge). Closure: skipped on
            // partial reloads. Not named `chat`: that is the page prop of /obrolan.
            'chatUnread' => fn (): ?int => $user !== null && (bool) config('features.chat')
                ? app(ChatInbox::class)->unreadChannels($user)
                : null,
            // Local demo only: personas of the account switcher at the top of the shell.
            'demoSwitcher' => fn (): ?array => $user !== null ? DemoAccounts::switcherProps($user->email) : null,
        ];
    }

    /**
     * Props resolved once and remembered by the client across navigations.
     *
     * @return array<string, callable|OnceProp>
     */
    public function shareOnce(Request $request): array
    {
        $user = $request->user();

        return [
            ...parent::shareOnce($request),
            // Sidebar check-in widget + topbar button (Sprint 2). Refreshed every
            // 5 minutes, and by the Absensi page right after a check-in/out.
            // Keyed by the signed-in user: the `null` remembered on the guest
            // login page (or another account's status) is never reused after
            // signing in, because the client only skips once-props by key.
            'attendanceStatus' => Inertia::once(
                fn (): ?array => $user instanceof User ? app(MyAttendance::class)->status($user, CarbonImmutable::now()) : null,
            )->as('attendanceStatus:'.($user instanceof User ? $user->getAuthIdentifier() : 'guest'))->until(300),
        ];
    }
}
