<?php

namespace App\Domain\Attendance\Models;

use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Enums\RequestPortion;
use App\Domain\Organization\Enums\Permission;
use App\Models\EmployeeRequest;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Factories\AttendanceDayFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * One row per employee per work date (docs/DATABASE.md §2).
 *
 * @property string $id
 * @property string $user_id
 * @property CarbonImmutable $work_date
 * @property string|null $shift_id
 * @property CarbonImmutable|null $scheduled_start
 * @property CarbonImmutable|null $scheduled_end
 * @property CarbonImmutable|null $check_in_at
 * @property CarbonImmutable|null $check_out_at
 * @property string|null $check_in_log_id
 * @property string|null $check_out_log_id
 * @property AttendanceStatus $status
 * @property int $late_minutes
 * @property int $early_leave_minutes
 * @property int $work_minutes
 * @property int $overtime_minutes
 * @property string|null $request_id
 * @property RequestPortion|null $request_portion
 * @property bool $is_suspicious
 * @property string|null $note
 * @property list<string>|null $work_plan
 * @property list<string>|null $work_report
 * @property string|null $status_source `manual` = status set by HR (SetAttendanceStatus)
 * @property string|null $status_set_by
 * @property CarbonImmutable|null $status_set_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $user
 * @property-read Shift|null $shift
 * @property-read AttendanceLog|null $checkInLog
 * @property-read AttendanceLog|null $checkOutLog
 */
#[Fillable([
    'user_id', 'work_date', 'shift_id', 'scheduled_start', 'scheduled_end', 'check_in_at', 'check_out_at',
    'check_in_log_id', 'check_out_log_id', 'status', 'late_minutes', 'early_leave_minutes', 'work_minutes',
    'overtime_minutes', 'request_id', 'request_portion', 'is_suspicious', 'note', 'work_plan', 'work_report',
    'status_source', 'status_set_by', 'status_set_at',
])]
#[UseFactory(AttendanceDayFactory::class)]
class AttendanceDay extends Model
{
    /** @use HasFactory<AttendanceDayFactory> */
    use HasFactory, HasUlids;

    /** @var array<string, mixed> */
    protected $attributes = [
        'late_minutes' => 0,
        'early_leave_minutes' => 0,
        'work_minutes' => 0,
        'overtime_minutes' => 0,
        'is_suspicious' => false,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'work_date' => 'immutable_date',
            'scheduled_start' => 'immutable_datetime',
            'scheduled_end' => 'immutable_datetime',
            'check_in_at' => 'immutable_datetime',
            'check_out_at' => 'immutable_datetime',
            'status' => AttendanceStatus::class,
            'request_portion' => RequestPortion::class,
            'late_minutes' => 'integer',
            'early_leave_minutes' => 'integer',
            'work_minutes' => 'integer',
            'overtime_minutes' => 'integer',
            'is_suspicious' => 'boolean',
            'work_plan' => 'array',
            'work_report' => 'array',
            'status_set_at' => 'immutable_datetime',
        ];
    }

    public function hasCheckedIn(): bool
    {
        return $this->check_in_at !== null;
    }

    public function hasCheckedOut(): bool
    {
        return $this->check_out_at !== null;
    }

    /** attendance_days.status_source of a status HR set by hand. */
    public const string SOURCE_MANUAL = 'manual';

    /**
     * HR set this day's status by hand (Absensi › Pegawai). Closing the day
     * leaves it alone; a real check-in/out or an approved request clears it.
     */
    public function isManual(): bool
    {
        return $this->status_source === self::SOURCE_MANUAL;
    }

    /**
     * Linked to an approved absence request (cuti/izin/sakit/dinas). A
     * cuti/izin/sakit/dinas status HR set by hand without a request is not.
     */
    public function isFromRequest(): bool
    {
        return $this->request_id !== null || ($this->status->comesFromRequest() && ! $this->isManual());
    }

    /**
     * Back to an ordinary day: the attendance (or a request) decides the status again.
     */
    public function clearManualStatus(): void
    {
        $this->status_source = null;
        $this->status_set_by = null;
        $this->status_set_at = null;
    }

    /**
     * An approved request covers this date but the employee is still expected to
     * work: a half-day leave/permit, or a business trip (checked in remotely).
     */
    public function allowsCheckInDespiteRequest(): bool
    {
        return $this->status === AttendanceStatus::BusinessTrip || $this->request_portion === RequestPortion::HalfDay;
    }

    /**
     * Check-in is refused: a full-day leave, permit or sick day.
     */
    public function blocksCheckIn(): bool
    {
        return $this->isFromRequest() && ! $this->allowsCheckInDespiteRequest();
    }

    /**
     * Attendance scope (docs/ARCHITECTURE.md §4): own days, direct reports, the
     * divisions a Kepala Divisi leads, or the whole company with
     * attendance.view_all (HR, Direksi, Super Admin).
     *
     * @param  Builder<AttendanceDay>  $query
     */
    public function scopeVisibleTo(Builder $query, User $viewer): void
    {
        $query->whereIn($this->qualifyColumn('user_id'), self::visibleUserIds($viewer));
    }

    /**
     * Sub-query of user ids whose attendance the viewer may see.
     *
     * @return Builder<User>
     */
    public static function visibleUserIds(User $viewer): Builder
    {
        $users = User::query()->select('users.id')->where('users.company_id', $viewer->company_id);

        if ($viewer->hasPermission(Permission::AttendanceViewAll)) {
            return $users;
        }

        $divisionIds = $viewer->ledDivisionIds();

        return $users->where(function (Builder $scope) use ($viewer, $divisionIds): void {
            $scope->where('users.id', $viewer->id)->orWhere('users.manager_id', $viewer->id);

            if ($divisionIds !== []) {
                $scope->orWhereIn('users.division_id', $divisionIds);
            }
        });
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * The approved absence request this day is linked to (request_id).
     *
     * @return BelongsTo<EmployeeRequest, $this>
     */
    public function employeeRequest(): BelongsTo
    {
        return $this->belongsTo(EmployeeRequest::class, 'request_id');
    }

    /**
     * @return BelongsTo<Shift, $this>
     */
    public function shift(): BelongsTo
    {
        return $this->belongsTo(Shift::class)->withTrashed();
    }

    /**
     * HR / Super Admin who set the status by hand.
     *
     * @return BelongsTo<User, $this>
     */
    public function statusSetter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'status_set_by');
    }

    /**
     * @return BelongsTo<AttendanceLog, $this>
     */
    public function checkInLog(): BelongsTo
    {
        return $this->belongsTo(AttendanceLog::class, 'check_in_log_id');
    }

    /**
     * @return BelongsTo<AttendanceLog, $this>
     */
    public function checkOutLog(): BelongsTo
    {
        return $this->belongsTo(AttendanceLog::class, 'check_out_log_id');
    }

    /**
     * @return HasMany<AttendanceLog, $this>
     */
    public function logs(): HasMany
    {
        return $this->hasMany(AttendanceLog::class);
    }
}
