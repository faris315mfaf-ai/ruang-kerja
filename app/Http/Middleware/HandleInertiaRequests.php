<?php

namespace App\Http\Middleware;

use App\Domain\Chat\Queries\ChatInbox;
use App\Domain\Hiring\Services\HiringAccess;
use App\Domain\Notifications\Services\InboxQuery;
use App\Domain\Organization\Demo\DemoAccounts;
use App\Domain\Requests\Services\ApprovalQueue;
use App\Domain\RoleDashboards\Services\RoleDashboardAccess;
use App\Domain\Tenancy\CompanyContext;
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
        // "Wajib ganti kata sandi" (EnsurePasswordChanged): the shell gets no account
        // data (counts, workspaces, attendance) until the employee chose their own
        // password — it may be someone using the shared default password (audit R-10).
        $data = $user !== null && ! $user->password_change_required ? $user : null;

        // Small PK lookups; gives the shell the user's place in the organization.
        // Separate queries on purpose: loading partial columns into the user's own
        // relations would leak into controllers/actions (e.g. company.google_domain).
        // The company comes from CompanyContext (ResolveCompanyContext): loaded once per request.
        $company = $user !== null ? $this->companyOf($user) : null;
        $division = $user?->division_id !== null ? Division::query()->whereKey($user->division_id)->first(['id', 'name', 'code']) : null;
        $position = $user?->position_id !== null ? Position::query()->whereKey($user->position_id)->first(['id', 'name', 'level', 'dashboard_role']) : null;

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
            'approvals' => fn (): ?array => $data !== null ? ['pending' => app(ApprovalQueue::class)->count($data)] : null,
            // Dock/Rail "Workspace" stack & mobile Menu grid (Sprint 5); lazy, skipped on partial reloads.
            'workspaces' => fn (): array => $data === null ? [] : app(SidebarWorkspaces::class)->for($data),
            // Bell / Dock / tab badge. Closure: skipped on partial reloads that don't ask for it.
            'inbox' => fn (): ?array => $data !== null ? ['unread' => app(InboxQuery::class)->unreadCount($data)] : null,
            // Fase 2 & 3 front-end previews (/pratinjau, config/features.php).
            // role_dashboards: flag on AND this user has a job dashboard (Dock/Rail/Menu entry).
            'features' => [
                'prototype' => (bool) config('features.prototype'),
                'chat' => (bool) config('features.chat'),
                'okr' => (bool) config('features.okr'),
                'automation' => (bool) config('features.automation'),
                'notes' => (bool) config('features.notes'),
                'meetings' => (bool) config('features.meetings'),
                // `hiring`: may open /hiring (HR, Super Admin, assigned reviewers; one EXISTS query for the others).
                'hiring' => $data !== null && app(HiringAccess::class)->canEnter($data),
                'role_dashboards' => $data !== null && (bool) config('features.role_dashboards') && app(RoleDashboardAccess::class)->hasAny($data, $position?->dashboard_role),
            ],
            // Obrolan (F2-1): channels with unread messages (Dock tile / Menu badge). Closure: skipped on
            // partial reloads. Not named `chat`: that is the page prop of /obrolan.
            'chatUnread' => fn (): ?int => $data !== null && (bool) config('features.chat')
                ? app(ChatInbox::class)->unreadChannels($data)
                : null,
            // Local demo only: personas of the account switcher at the top of the shell.
            'demoSwitcher' => fn (): ?array => $user !== null ? DemoAccounts::switcherProps($user->email) : null,
        ];
    }

    /**
     * The signed-in user's company, from the request's CompanyContext. Falls back
     * to a direct lookup when the context belongs to no/another company (e.g. an
     * error page rendered outside the middleware stack).
     */
    private function companyOf(User $user): ?Company
    {
        $context = app(CompanyContext::class);

        if ($context->id() === null) {
            $context->set($user->company_id);
        }

        return $context->id() === $user->company_id
            ? $context->company()
            : Company::query()->whereKey($user->company_id)->first(['id', 'name']);
    }

    /**
     * Props resolved once and remembered by the client across navigations.
     *
     * @return array<string, callable|OnceProp>
     */
    public function shareOnce(Request $request): array
    {
        $user = $request->user();
        // Withheld while a password change is required (see share()); the key
        // changes with it, so the client does not keep the withheld `null`.
        $locked = $user instanceof User && $user->password_change_required;

        return [
            ...parent::shareOnce($request),
            // Sidebar check-in widget + topbar button (Sprint 2). Refreshed every
            // 5 minutes, and by the Absensi page right after a check-in/out.
            // Keyed by the signed-in user: the `null` remembered on the guest
            // login page (or another account's status) is never reused after
            // signing in, because the client only skips once-props by key.
            'attendanceStatus' => Inertia::once(
                fn (): ?array => $user instanceof User && ! $locked ? app(MyAttendance::class)->status($user, CarbonImmutable::now()) : null,
            )->as('attendanceStatus:'.($user instanceof User ? $user->getAuthIdentifier() : 'guest').($locked ? ':locked' : ''))->until(300),
        ];
    }
}
