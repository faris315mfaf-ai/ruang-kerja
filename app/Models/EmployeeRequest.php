<?php

namespace App\Models;

use App\Domain\Organization\Enums\Permission;
use App\Domain\Requests\Enums\ApprovalStatus;
use App\Domain\Requests\Enums\RequestStatus;
use Database\Factories\EmployeeRequestFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Support\Carbon;

/**
 * Pengajuan (cuti, izin, sakit, lembur, koreksi absensi, dinas luar), table `requests`.
 * Named EmployeeRequest to avoid clashing with Illuminate\Http\Request.
 *
 * Files (doctor's letters, …) live in `attachments` (morph, source `storage`, private disk).
 *
 * payload keys by category:
 * - leave: `half_day` bool
 * - permit: `mode` 'hours'|'days'
 * - overtime: `date`, `start_time`, `end_time`
 * - correction: `date`, `check_in`, `check_out` (HH:MM, office time; either may be null)
 * - business_trip: `destination`
 *
 * @property string $id
 * @property string|null $number
 * @property string $user_id
 * @property string $leave_type_id
 * @property Carbon $start_at
 * @property Carbon $end_at
 * @property float|null $days
 * @property int|null $minutes
 * @property string $reason
 * @property array<string, mixed> $payload
 * @property string|null $substitute_id
 * @property RequestStatus $status
 * @property int $round
 * @property int|null $current_step
 * @property Carbon|null $submitted_at
 * @property Carbon|null $decided_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $user
 * @property-read LeaveType $leaveType
 * @property-read User|null $substitute
 * @property-read Collection<int, RequestApproval> $approvals
 * @property-read Collection<int, Attachment> $attachments
 */
#[Fillable([
    'number', 'user_id', 'leave_type_id', 'start_at', 'end_at', 'days', 'minutes', 'reason',
    'payload', 'substitute_id', 'status', 'round', 'current_step', 'submitted_at', 'decided_at',
])]
class EmployeeRequest extends Model
{
    /** @use HasFactory<EmployeeRequestFactory> */
    use HasFactory, HasUlids;

    protected $table = 'requests';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => 'draft',
        'round' => 1,
        'payload' => '{}',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'start_at' => 'datetime',
            'end_at' => 'datetime',
            'days' => 'float',
            'minutes' => 'integer',
            'payload' => 'array',
            'status' => RequestStatus::class,
            'round' => 'integer',
            'current_step' => 'integer',
            'submitted_at' => 'datetime',
            'decided_at' => 'datetime',
        ];
    }

    /**
     * Steps of the current round, in order.
     *
     * @return Collection<int, RequestApproval>
     */
    public function currentSteps(): Collection
    {
        $this->loadMissing('approvals');

        return $this->approvals
            ->where('round', $this->round)
            ->sortBy('step_order')
            ->values();
    }

    /**
     * People who already approved a step of the current round — the deciding
     * user and, for a delegated step, the delegator it was decided for. None of
     * them may approve another step of the same round.
     *
     * @return list<string>
     */
    public function approverIdsOfRound(): array
    {
        $ids = [];

        foreach ($this->currentSteps() as $step) {
            if ($step->status !== ApprovalStatus::Approved) {
                continue;
            }

            foreach ([$step->approver_id, $step->delegated_from_id] as $id) {
                if ($id !== null && ! in_array($id, $ids, true)) {
                    $ids[] = $id;
                }
            }
        }

        return $ids;
    }

    public function waitingStep(): ?RequestApproval
    {
        return $this->currentSteps()->first(fn (RequestApproval $step): bool => $step->status === ApprovalStatus::Waiting);
    }

    /**
     * Requests the viewer may see: those of people in their scope (self, direct
     * reports, led divisions; whole company with requests.view_all) plus any
     * request where they are or were an approver (incl. as delegate).
     *
     * @param  Builder<EmployeeRequest>  $query
     */
    public function scopeVisibleTo(Builder $query, User $viewer): void
    {
        $query->whereIn(
            $this->qualifyColumn('user_id'),
            User::query()->where('company_id', $viewer->company_id)->select('id'),
        );

        if ($viewer->hasPermission(Permission::RequestsViewAll)) {
            return;
        }

        $query->where(function (Builder $scope) use ($viewer): void {
            $scope->whereIn($this->qualifyColumn('user_id'), User::query()->visibleTo($viewer)->select('id'))
                ->orWhereHas('approvals', fn (Builder $approvals) => $approvals->where(
                    fn (Builder $mine) => $mine->where('approver_id', $viewer->id)->orWhere('delegated_from_id', $viewer->id),
                ));
        });
    }

    /**
     * @param  Builder<EmployeeRequest>  $query
     */
    public function scopeOwnedBy(Builder $query, User $user): void
    {
        $query->where($this->qualifyColumn('user_id'), $user->id);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<LeaveType, $this>
     */
    public function leaveType(): BelongsTo
    {
        return $this->belongsTo(LeaveType::class)->withTrashed();
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function substitute(): BelongsTo
    {
        return $this->belongsTo(User::class, 'substitute_id');
    }

    /**
     * Files on the private disk (oldest first).
     *
     * @return MorphMany<Attachment, $this>
     */
    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable')->orderBy('created_at')->orderBy('id');
    }

    /**
     * All steps of all rounds.
     *
     * @return HasMany<RequestApproval, $this>
     */
    public function approvals(): HasMany
    {
        return $this->hasMany(RequestApproval::class, 'request_id')->orderBy('round')->orderBy('step_order');
    }
}
