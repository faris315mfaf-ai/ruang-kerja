<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Organization\Enums\AuditSubject;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AuditLogIndexRequest;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\Division;
use App\Models\Position;
use App\Models\Team;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin › Audit log (Super Admin, read-only, desktop).
 */
class AuditLogController extends Controller
{
    public const int PER_PAGE = 25;

    /**
     * Foreign-key columns whose ids are resolved to names in the detail drawer.
     *
     * @var array<string, class-string<Model>>
     */
    private const array REFERENCES = [
        'company_id' => Company::class,
        'division_id' => Division::class,
        'parent_id' => Division::class,
        'team_id' => Team::class,
        'position_id' => Position::class,
        'manager_id' => User::class,
        'head_user_id' => User::class,
        'lead_user_id' => User::class,
        'user_id' => User::class,
    ];

    public function index(AuditLogIndexRequest $request, #[CurrentUser] User $viewer): Response
    {
        Gate::authorize('viewAny', AuditLog::class);

        $filters = $request->filters();
        $subject = $filters['subjek'] === null ? null : AuditSubject::from($filters['subjek']);

        $logs = AuditLog::query()
            ->visibleTo($viewer)
            ->with('user:id,name,avatar_url')
            ->when($filters['aktor'], function (Builder $query, string $actor): void {
                $actor === AuditLogIndexRequest::SYSTEM_ACTOR
                    ? $query->whereNull('user_id')
                    : $query->where('user_id', $actor);
            })
            ->when($filters['aksi'], function (Builder $query, string $action): void {
                // "division." matches every division action; otherwise exact.
                str_ends_with($action, '.')
                    ? $query->where('action', 'like', addcslashes($action, '%_\\').'%')
                    : $query->where('action', $action);
            })
            ->when($subject, fn (Builder $query, AuditSubject $subject) => $query->where('auditable_type', $subject->modelClass()))
            ->when($request->fromUtc(), fn (Builder $query, $from) => $query->where('created_at', '>=', $from))
            ->when($request->untilUtc(), fn (Builder $query, $until) => $query->where('created_at', '<', $until))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(self::PER_PAGE)
            ->withQueryString();

        /** @var Collection<int, AuditLog> $rows */
        $rows = $logs->getCollection();
        $this->loadSubjects($rows);

        return Inertia::render('admin/audit/index', [
            'filters' => $filters,
            'logs' => [
                'data' => $rows->map(fn (AuditLog $log): array => $this->row($log))->values()->all(),
                'currentPage' => $logs->currentPage(),
                'lastPage' => $logs->lastPage(),
                'total' => $logs->total(),
                'from' => $logs->firstItem(),
                'to' => $logs->lastItem(),
                'prevUrl' => $logs->previousPageUrl(),
                'nextUrl' => $logs->nextPageUrl(),
            ],
            'references' => $this->references($rows),
            'options' => [
                'actors' => $this->actorOptions($viewer),
                'actions' => $this->actionOptions($viewer),
                'subjects' => AuditSubject::options(),
            ],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function row(AuditLog $log): array
    {
        $subject = AuditSubject::fromModelClass($log->auditable_type);
        $model = $log->auditable;
        $name = $model?->getAttribute('name');
        $fallback = $log->old_values['name'] ?? $log->new_values['name'] ?? null;

        return [
            'id' => $log->id,
            'action' => $log->action,
            'createdAt' => $log->created_at->toIso8601String(),
            'actor' => $log->user === null ? null : [
                'id' => $log->user->id,
                'name' => $log->user->name,
                'avatar' => $log->user->avatar_url,
            ],
            'subject' => $log->auditable_type === null ? null : [
                'type' => $subject?->value,
                'typeLabel' => $subject?->label() ?? class_basename($log->auditable_type),
                'id' => $log->auditable_id,
                'name' => is_string($name) ? $name : (is_string($fallback) ? $fallback : null),
                'deleted' => $model === null || ($model->getAttribute('deleted_at') !== null),
            ],
            'oldValues' => $log->old_values,
            'newValues' => $log->new_values,
            'ipAddress' => $log->ip_address,
            'userAgent' => $log->user_agent,
        ];
    }

    /**
     * Loads each row's subject with one query per subject type — soft-deleted
     * ones included, so their name stays visible. Every row gets the relation
     * set (null for system rows without a subject), so nothing lazy-loads.
     *
     * @param  Collection<int, AuditLog>  $rows
     */
    private function loadSubjects(Collection $rows): void
    {
        foreach ($rows->groupBy(fn (AuditLog $log): string => (string) $log->auditable_type) as $type => $group) {
            $type = (string) $type;
            $models = $type === '' || ! is_subclass_of($type, Model::class) ? collect() : $type::query()
                ->withoutGlobalScopes()
                ->whereKey($group->pluck('auditable_id')->filter()->unique()->values()->all())
                ->get()
                ->keyBy(fn (Model $model): string => (string) $model->getKey());

            foreach ($group as $log) {
                $log->setRelation('auditable', $models->get((string) $log->auditable_id));
            }
        }
    }

    /**
     * Names for the ids found in foreign-key columns of the visible rows.
     *
     * @param  Collection<int, AuditLog>  $rows
     * @return array<string, string>
     */
    private function references(Collection $rows): array
    {
        /** @var array<class-string<Model>, list<string>> $ids */
        $ids = [];

        foreach ($rows as $log) {
            foreach ([$log->old_values ?? [], $log->new_values ?? []] as $values) {
                foreach (self::REFERENCES as $column => $model) {
                    if (isset($values[$column]) && is_string($values[$column])) {
                        $ids[$model][] = $values[$column];
                    }
                }
            }
        }

        $names = [];

        foreach ($ids as $model => $keys) {
            // Without global scopes: soft-deleted units keep their name in the history.
            foreach ($model::query()->withoutGlobalScopes()->whereKey(array_values(array_unique($keys)))->get(['id', 'name']) as $record) {
                $label = $record->getAttribute('name');
                $names[(string) $record->getKey()] = is_string($label) ? $label : (string) $record->getKey();
            }
        }

        return $names;
    }

    /**
     * People who appear as actors (plus the "Sistem" pseudo actor).
     *
     * @return list<array{value: string, label: string}>
     */
    private function actorOptions(User $viewer): array
    {
        $actors = User::query()
            ->where('company_id', $viewer->company_id)
            ->whereIn('id', AuditLog::query()->select('user_id')->whereNotNull('user_id'))
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (User $user): array => ['value' => $user->id, 'label' => $user->name])
            ->values()
            ->all();

        return [['value' => AuditLogIndexRequest::SYSTEM_ACTOR, 'label' => 'Sistem (otomatis)'], ...$actors];
    }

    /**
     * Distinct actions present in the log, e.g. ["division.created", …].
     *
     * @return list<string>
     */
    private function actionOptions(User $viewer): array
    {
        /** @var list<string> $actions */
        $actions = AuditLog::query()
            ->visibleTo($viewer)
            ->distinct()
            ->orderBy('action')
            ->pluck('action')
            ->all();

        return $actions;
    }
}
