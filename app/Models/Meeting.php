<?php

namespace App\Models;

use App\Domain\Attendance\Casts\PostgresIntArray;
use App\Domain\Meetings\Enums\MeetingPlatform;
use App\Domain\Meetings\Enums\Recurrence;
use App\Domain\Organization\Enums\Permission;
use Carbon\CarbonImmutable;
use Database\Factories\MeetingFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Query\Builder as QueryBuilder;

/**
 * Meeting or meeting series (docs/DATABASE.md §7, F2-3). Times are UTC; a
 * recurring series is expanded into occurrences when read
 * (App\Domain\Meetings\Services\MeetingOccurrences). Visible to the
 * organizer, the minute taker and internal participants; leadership meetings
 * also to holders of dashboard.view_company (Direksi, HR, Super Admin) —
 * same rules as MeetingPolicy::canView.
 *
 * @property string $id
 * @property string $company_id
 * @property string|null $workspace_id
 * @property string $title
 * @property string|null $description
 * @property CarbonImmutable $starts_at
 * @property CarbonImmutable $ends_at
 * @property MeetingPlatform $platform
 * @property string|null $location
 * @property string|null $join_url
 * @property string $organizer_id
 * @property string|null $minute_taker_id
 * @property list<string> $agenda
 * @property Recurrence $recurrence
 * @property CarbonImmutable|null $recurrence_until
 * @property list<int> $reminders
 * @property bool $leadership
 * @property bool $auto_minutes "Notulen otomatis" (transcript + AI draft; only platform video, docs/fitur/notulen-otomatis-kontrak.md §6)
 * @property CarbonImmutable|null $canceled_at
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property CarbonImmutable|null $deleted_at
 * @property-read Workspace|null $workspace
 * @property-read User $organizer
 * @property-read User|null $minuteTaker
 * @property-read Collection<int, MeetingParticipant> $participants
 * @property-read Collection<int, MeetingMinutes> $minutes
 */
#[Fillable([
    'company_id', 'workspace_id', 'title', 'description', 'starts_at', 'ends_at', 'platform', 'location',
    'join_url', 'organizer_id', 'minute_taker_id', 'agenda', 'recurrence', 'recurrence_until', 'reminders',
    'leadership', 'canceled_at', 'auto_minutes',
])]
class Meeting extends Model
{
    /** @use HasFactory<MeetingFactory> */
    use HasFactory, HasUlids, SoftDeletes;

    /** @var array<string, mixed> */
    protected $attributes = [
        'agenda' => '[]',
        'recurrence' => 'none',
        'reminders' => '{15,5}',
        'leadership' => false,
        'auto_minutes' => false,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'platform' => MeetingPlatform::class,
            'agenda' => 'array',
            'recurrence' => Recurrence::class,
            'recurrence_until' => 'date',
            'reminders' => PostgresIntArray::class,
            'leadership' => 'boolean',
            'auto_minutes' => 'boolean',
            'canceled_at' => 'datetime',
        ];
    }

    /**
     * Meetings the viewer may open (MeetingPolicy::canView).
     *
     * @param  Builder<Meeting>  $query
     */
    public function scopeVisibleTo(Builder $query, User $viewer): void
    {
        if (! $viewer->isActive()) {
            $query->whereRaw('false');

            return;
        }

        $seesLeadership = $viewer->hasPermission(Permission::DashboardViewCompany);

        $query->where($this->qualifyColumn('company_id'), $viewer->company_id)
            ->where(function (Builder $scope) use ($viewer, $seesLeadership): void {
                $scope->where(fn (Builder $mine) => $this->whereInvolves($mine, $viewer))
                    ->when($seesLeadership, fn (Builder $leadership) => $leadership->orWhere($this->qualifyColumn('leadership'), true));
            });
    }

    /**
     * "Rapat saya": meetings the viewer organizes, takes minutes of or is
     * invited to (not leadership meetings seen only through the permission).
     *
     * @param  Builder<Meeting>  $query
     */
    public function scopeInvolving(Builder $query, User $viewer): void
    {
        $query->where($this->qualifyColumn('company_id'), $viewer->company_id)
            ->where(fn (Builder $mine) => $this->whereInvolves($mine, $viewer));
    }

    /**
     * Not canceled.
     *
     * @param  Builder<Meeting>  $query
     */
    public function scopeActive(Builder $query): void
    {
        $query->whereNull($this->qualifyColumn('canceled_at'));
    }

    /**
     * Series with at least one occurrence overlapping [from, to) — the exact
     * occurrences are computed by MeetingOccurrences.
     *
     * @param  Builder<Meeting>  $query
     */
    public function scopeOverlapping(Builder $query, CarbonImmutable $from, CarbonImmutable $to): void
    {
        $fromDate = $from->setTimezone(config()->string('app.office_timezone'))->toDateString();

        $query->where($this->qualifyColumn('starts_at'), '<', $to)
            ->where(function (Builder $scope) use ($from, $fromDate): void {
                $scope->where(function (Builder $single) use ($from): void {
                    $single->where($this->qualifyColumn('recurrence'), Recurrence::None->value)
                        ->where($this->qualifyColumn('ends_at'), '>', $from);
                })->orWhere(function (Builder $series) use ($fromDate): void {
                    $series->where($this->qualifyColumn('recurrence'), '!=', Recurrence::None->value)
                        ->where(fn (Builder $until) => $until->whereNull($this->qualifyColumn('recurrence_until'))
                            ->orWhereDate($this->qualifyColumn('recurrence_until'), '>=', $fromDate));
                });
            });
    }

    /**
     * @param  Builder<Meeting>  $query
     */
    private function whereInvolves(Builder $query, User $viewer): void
    {
        $query->where($this->qualifyColumn('organizer_id'), $viewer->id)
            ->orWhere($this->qualifyColumn('minute_taker_id'), $viewer->id)
            ->orWhereExists(function (QueryBuilder $participant) use ($viewer): void {
                $participant->selectRaw('1')
                    ->from('meeting_participants')
                    ->whereColumn('meeting_participants.meeting_id', $this->qualifyColumn('id'))
                    ->where('meeting_participants.user_id', $viewer->id);
            });
    }

    public function isCanceled(): bool
    {
        return $this->canceled_at !== null;
    }

    public function isRecurring(): bool
    {
        return $this->recurrence !== Recurrence::None;
    }

    public function durationMinutes(): int
    {
        return (int) $this->starts_at->diffInMinutes($this->ends_at);
    }

    /** Office date of the first occurrence. */
    public function firstDate(): string
    {
        return $this->starts_at->setTimezone(config()->string('app.office_timezone'))->toDateString();
    }

    /**
     * Internal participant (ULID) or null.
     */
    public function participantFor(User $user): ?MeetingParticipant
    {
        return $this->relationLoaded('participants')
            ? $this->participants->firstWhere('user_id', $user->id)
            : $this->participants()->where('user_id', $user->id)->first();
    }

    public function involves(User $user): bool
    {
        return $this->organizer_id === $user->id
            || $this->minute_taker_id === $user->id
            || $this->participantFor($user) !== null;
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * @return BelongsTo<Workspace, $this>
     */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function organizer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'organizer_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function minuteTaker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'minute_taker_id');
    }

    /**
     * @return HasMany<MeetingParticipant, $this>
     */
    public function participants(): HasMany
    {
        return $this->hasMany(MeetingParticipant::class);
    }

    /**
     * @return HasMany<MeetingMinutes, $this>
     */
    public function minutes(): HasMany
    {
        return $this->hasMany(MeetingMinutes::class);
    }
}
