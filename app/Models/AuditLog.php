<?php

namespace App\Models;

use App\Domain\Organization\Enums\Permission;
use App\Domain\Tenancy\CompanyContext;
use Database\Factories\AuditLogFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Carbon;
use LogicException;

/**
 * Append-only audit trail. Write through App\Domain\Organization\Services\AuditLogger.
 *
 * @property string $id
 * @property string|null $company_id
 * @property string|null $user_id
 * @property string $action
 * @property string|null $auditable_type
 * @property string|null $auditable_id
 * @property array<string, mixed>|null $old_values
 * @property array<string, mixed>|null $new_values
 * @property string|null $ip_address
 * @property string|null $user_agent
 * @property Carbon $created_at
 * @property-read User|null $user
 * @property-read Model|null $auditable
 */
#[Fillable(['company_id', 'user_id', 'action', 'auditable_type', 'auditable_id', 'old_values', 'new_values', 'ip_address', 'user_agent'])]
class AuditLog extends Model
{
    /** @use HasFactory<AuditLogFactory> */
    use HasFactory, HasUlids;

    public const null UPDATED_AT = null;

    protected static function booted(): void
    {
        static::updating(function (): never {
            throw new LogicException('Audit log bersifat append-only dan tidak dapat diubah.');
        });

        // Rows written without an explicit company (factories, direct creates)
        // follow their actor, the current company context, or their subject.
        static::creating(function (self $log): void {
            $log->company_id ??= self::companyIdFor($log->user_id, $log->auditable_type, $log->auditable_id);
        });
    }

    /**
     * The company an entry belongs to: the actor's, else the current company
     * context (queued job, webhook), else the subject's (directly, or through
     * its user/workspace). Null = platform/infrastructure entry, shown to no
     * company's auditor.
     */
    public static function companyIdFor(?string $userId, ?string $subjectType, ?string $subjectId, ?Model $subject = null, bool $useContext = true): ?string
    {
        if ($userId !== null) {
            $company = User::query()->whereKey($userId)->value('company_id');

            if (is_string($company)) {
                return $company;
            }
        }

        $context = $useContext ? app(CompanyContext::class)->id() : null;

        if ($context !== null) {
            return $context;
        }

        if ($subject === null && $subjectType !== null && $subjectId !== null && is_subclass_of($subjectType, Model::class)) {
            $subject = $subjectType::query()->withoutGlobalScopes()->find($subjectId);
        }

        return $subject === null ? null : self::subjectCompanyId($subject);
    }

    private static function subjectCompanyId(Model $subject): ?string
    {
        if ($subject instanceof Company) {
            return $subject->getKey();
        }

        foreach (['company_id' => null, 'user_id' => User::class, 'workspace_id' => Workspace::class, 'division_id' => Division::class] as $column => $parent) {
            $value = $subject->getAttributes()[$column] ?? null;

            if (! is_string($value) || $value === '') {
                continue;
            }

            $company = $parent === null ? $value : $parent::query()->withoutGlobalScopes()->whereKey($value)->value('company_id');

            if (is_string($company)) {
                return $company;
            }
        }

        return null;
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'old_values' => 'array',
            'new_values' => 'array',
            'created_at' => 'datetime',
        ];
    }

    /**
     * Rows a viewer may read: nothing without audit.view; otherwise the entries
     * of the viewer's company — changes by its people and its system changes
     * (console/queue, no actor). Entries of other companies and platform
     * entries without a company stay hidden (Fase 1, docs/sesi/fase1-celah.md C1).
     *
     * @param  Builder<AuditLog>  $query
     */
    public function scopeVisibleTo(Builder $query, User $viewer): void
    {
        if (! $viewer->hasPermission(Permission::AuditView)) {
            $query->whereRaw('1 = 0');

            return;
        }

        $query->where($this->qualifyColumn('company_id'), $viewer->company_id);
    }

    /**
     * The actor (null for system / console changes).
     *
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return MorphTo<Model, $this>
     */
    public function auditable(): MorphTo
    {
        return $this->morphTo();
    }
}
