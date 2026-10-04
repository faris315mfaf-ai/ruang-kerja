<?php

namespace App\Models\Concerns;

use App\Domain\Organization\Services\AuditLogger;
use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * Automatically records `<name>.created|updated|deleted|restored` in audit_logs
 * with the before/after values of the changed attributes.
 *
 * - Values are raw DB values; encrypted/hashed casts and sensitive keys are masked.
 * - Override auditExclude() to ignore noisy columns (timestamps are always ignored).
 * - Follows model events: Model::withoutEvents() / seeders using WithoutModelEvents
 *   and saveQuietly() write no audit rows.
 *
 * @mixin Model
 */
trait Auditable
{
    public static function bootAuditable(): void
    {
        static::created(fn (self $model) => $model->recordAuditEvent('created'));
        static::updated(fn (self $model) => $model->recordAuditEvent('updated'));
        static::deleted(fn (self $model) => $model->recordAuditEvent('deleted'));

        if (in_array(SoftDeletes::class, class_uses_recursive(static::class), true)) {
            static::registerModelEvent('restored', fn (self $model) => $model->recordAuditEvent('restored'));
        }
    }

    /**
     * Prefix of the audit action, e.g. `division` → `division.updated`.
     */
    public function auditName(): string
    {
        return Str::snake(class_basename($this));
    }

    /**
     * Attributes never written to the audit trail (in addition to timestamps).
     *
     * @return list<string>
     */
    public function auditExclude(): array
    {
        return [];
    }

    /**
     * @return MorphMany<AuditLog, $this>
     */
    public function auditLogs(): MorphMany
    {
        return $this->morphMany(AuditLog::class, 'auditable');
    }

    protected function recordAuditEvent(string $event): void
    {
        $ignored = [...$this->auditExclude(), 'created_at', 'updated_at', 'deleted_at'];
        $all = array_keys($this->getAttributes());
        $changed = array_keys($this->getChanges());

        [$old, $new] = match ($event) {
            'created', 'restored' => [null, $this->auditValues($all, $ignored, false)],
            'deleted' => [$this->auditValues($all, $ignored, true), null],
            default => [$this->auditValues($changed, $ignored, true), $this->auditValues($changed, $ignored, false)],
        };

        if ($event === 'updated' && $new === []) {
            return;
        }

        app(AuditLogger::class)->log("{$this->auditName()}.{$event}", $this, $old, $new);
    }

    /**
     * @param  list<string>  $keys
     * @param  list<string>  $ignored
     * @return array<string, mixed>
     */
    private function auditValues(array $keys, array $ignored, bool $original): array
    {
        $values = [];
        $casts = $this->getCasts();

        foreach ($keys as $key) {
            if (in_array($key, $ignored, true)) {
                continue;
            }

            $cast = is_string($casts[$key] ?? null) ? $casts[$key] : '';
            $value = $original ? $this->getRawOriginal($key) : ($this->getAttributes()[$key] ?? null);

            if ($value !== null && (str_starts_with($cast, 'encrypted') || $cast === 'hashed')) {
                $value = AuditLogger::MASK;
            } elseif (is_string($value) && in_array($cast, ['array', 'json', 'object', 'collection'], true)) {
                $value = json_decode($value, true);
            }

            $values[$key] = $value;
        }

        return $values;
    }
}
