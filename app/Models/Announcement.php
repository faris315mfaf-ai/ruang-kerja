<?php

namespace App\Models;

use App\Domain\Announcements\Enums\AnnouncementAudience;
use Carbon\CarbonImmutable;
use Database\Factories\AnnouncementFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Pengumuman (keputusan pemilik 6 Okt 2026; docs/DATABASE.md §6). Active =
 * published, not expired, not deleted. Received by everyone in the company
 * (audience all), the members of the target divisions and their
 * sub-divisions, or the members of the target teams.
 *
 * @property string $id
 * @property string $company_id
 * @property string|null $author_id
 * @property string $title
 * @property string $body
 * @property AnnouncementAudience $audience
 * @property list<string> $target_ids
 * @property CarbonImmutable $published_at
 * @property CarbonImmutable|null $expires_at
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property CarbonImmutable|null $deleted_at
 * @property-read User|null $author
 */
#[Fillable(['company_id', 'author_id', 'title', 'body', 'audience', 'target_ids', 'published_at', 'expires_at'])]
class Announcement extends Model
{
    /** @use HasFactory<AnnouncementFactory> */
    use HasFactory, HasUlids, SoftDeletes;

    /** @var array<string, mixed> */
    protected $attributes = [
        'target_ids' => '[]',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'audience' => AnnouncementAudience::class,
            'target_ids' => 'array',
            'published_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public function isActive(?CarbonImmutable $now = null): bool
    {
        $now ??= CarbonImmutable::now();

        return ! $this->trashed()
            && $this->published_at->lte($now)
            && ($this->expires_at === null || $this->expires_at->gt($now));
    }

    /**
     * Published, not expired (soft-deleted ones are excluded by default).
     *
     * @param  Builder<Announcement>  $query
     */
    public function scopeActive(Builder $query, ?CarbonImmutable $now = null): void
    {
        $now ??= CarbonImmutable::now();

        $query->where($this->qualifyColumn('published_at'), '<=', $now)
            ->where(fn (Builder $open) => $open
                ->whereNull($this->qualifyColumn('expires_at'))
                ->orWhere($this->qualifyColumn('expires_at'), '>', $now));
    }

    /**
     * Addressed to $user: same company and audience all, or one of the user's
     * division (or a parent division) / team is a target.
     *
     * @param  Builder<Announcement>  $query
     */
    public function scopeReceivedBy(Builder $query, User $user): void
    {
        $divisions = $user->division_id === null ? [] : Division::withAncestorIds($user->division_id);

        $query->where($this->qualifyColumn('company_id'), $user->company_id)
            ->where(function (Builder $audience) use ($divisions, $user): void {
                $audience->where($this->qualifyColumn('audience'), AnnouncementAudience::All->value);

                if ($divisions !== []) {
                    $audience->orWhere(function (Builder $division) use ($divisions): void {
                        $division->where($this->qualifyColumn('audience'), AnnouncementAudience::Division->value)
                            ->where(function (Builder $any) use ($divisions): void {
                                foreach ($divisions as $id) {
                                    $any->orWhereRaw('announcements.target_ids @> ?::jsonb', [json_encode([$id])]);
                                }
                            });
                    });
                }

                if ($user->team_id !== null) {
                    $audience->orWhere(fn (Builder $team) => $team
                        ->where($this->qualifyColumn('audience'), AnnouncementAudience::Team->value)
                        ->whereRaw('announcements.target_ids @> ?::jsonb', [json_encode([$user->team_id])]));
                }
            });
    }

    /**
     * Not dismissed from the dashboards by $user.
     *
     * @param  Builder<Announcement>  $query
     */
    public function scopeNotDismissedBy(Builder $query, User $user): void
    {
        $query->whereNotExists(fn ($dismissed) => $dismissed->selectRaw('1')
            ->from('announcement_dismissals')
            ->whereColumn('announcement_dismissals.announcement_id', $this->qualifyColumn('id'))
            ->where('announcement_dismissals.user_id', $user->id));
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * People who closed it on their dashboards.
     *
     * @return BelongsToMany<User, $this>
     */
    public function dismissedBy(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'announcement_dismissals')->withPivot('dismissed_at');
    }
}
