<?php

namespace App\Domain\Privacy\Services;

use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Enums\LogFlag;
use App\Domain\Attendance\Models\AttendanceConsent;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Support\OfficeClock;
use App\Domain\Requests\Services\ApprovalQueue;
use App\Domain\Requests\Support\RequestFormatter;
use App\Http\Presenters\EmployeePresenter;
use App\Models\EmployeeRequest;
use App\Models\GoogleAccount;
use App\Models\RequestApproval;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * "Data Saya" (Privasi, Sprint 10, UU PDP): everything the app holds about
 * ONE person, always queried by that person's own id — never another user's
 * rows. Used by the page (short lists) and the Excel/PDF export (everything).
 *
 * NIK never leaves the server in clear (masked like Admin › Karyawan).
 */
final class MyData
{
    public function __construct(
        private readonly ApprovalQueue $queue,
        private readonly PrivacyPolicy $policy,
    ) {}

    /**
     * Profile data held about the user.
     *
     * @return array<string, mixed>
     */
    public function profile(User $user): array
    {
        $user->loadMissing([
            'division:id,name',
            'team:id,name',
            'position:id,name',
            'manager:id,name',
            'profile',
            'roles:id,name',
        ]);
        $profile = $user->profile;
        $emergency = $profile?->emergency_contact;

        return [
            'name' => $user->name,
            'email' => $user->email,
            'employee_number' => $profile?->employee_number,
            'nik_masked' => EmployeePresenter::maskNik($profile?->nik),
            'phone' => $profile?->phone,
            'birth_date' => $profile?->birth_date?->toDateString(),
            'address' => $profile?->address,
            'emergency_contact' => $emergency === null || $emergency === [] ? null : trim(implode(' · ', array_filter([
                $emergency['name'] ?? null,
                $emergency['relation'] ?? null,
                $emergency['phone'] ?? null,
            ]))),
            'division' => $user->division?->name,
            'team' => $user->team?->name,
            'position' => $user->position?->name,
            'manager' => $user->manager?->name,
            'work_mode' => $user->work_mode->label(),
            'status' => $user->status->label(),
            'joined_at' => $user->joined_at?->toDateString(),
            'roles' => array_values($user->getRoleNames()->all()),
            'google_linked' => GoogleAccount::query()->where('user_id', $user->id)->exists(),
            'two_factor' => $user->two_factor_confirmed_at !== null,
            'last_login_at' => $user->last_login_at?->toIso8601String(),
        ];
    }

    /**
     * Location + selfie consent: current state against the policy version and
     * the full history (grants and withdrawals).
     *
     * @return array<string, mixed>
     */
    public function consent(User $user): array
    {
        $records = AttendanceConsent::query()
            ->where('user_id', $user->id)
            ->latest('granted_at')
            ->get();

        $active = $records->first(fn (AttendanceConsent $consent): bool => $consent->revoked_at === null);
        $current = AttendanceConsent::currentVersion();
        $granted = AttendanceConsent::hasCurrentConsent($user);

        return [
            'granted' => $granted,
            'version' => $current,
            'policy_version' => $this->policy->version(),
            'granted_version' => $active?->version,
            'granted_at' => $active?->granted_at->toIso8601String(),
            // Consented once, but for an older policy version.
            'needs_renewal' => ! $granted && $active !== null && $active->version !== $current,
            'retention_months' => config()->integer('attendance.selfie.retention_months'),
            'history' => $records->map(fn (AttendanceConsent $consent): array => [
                'id' => $consent->id,
                'type' => $consent->type->value,
                'type_label' => $consent->type->label(),
                'version' => $consent->version,
                'granted_at' => $consent->granted_at->toIso8601String(),
                'revoked_at' => $consent->revoked_at?->toIso8601String(),
            ])->values()->all(),
        ];
    }

    /**
     * Attendance on the page: totals per status (all time) + the latest days.
     *
     * @return array{total_days: int, counts: array<string, int>, first_date: string|null, logs: int, selfies: int, days: list<array<string, mixed>>}
     */
    public function attendance(User $user, int $limit): array
    {
        $counts = [];

        foreach (AttendanceDay::query()->where('user_id', $user->id)->selectRaw('status, count(*) as total')->groupBy('status')->toBase()->get() as $row) {
            $counts[(string) $row->status] = (int) $row->total;
        }

        $first = AttendanceDay::query()->where('user_id', $user->id)->min('work_date');

        $logs = AttendanceLog::query()
            ->where('user_id', $user->id)
            ->selectRaw('count(*) as total, count(selfie_path) as selfies')
            ->toBase()
            ->first();

        $days = $this->days($user)->limit($limit)->get();

        return [
            'total_days' => array_sum($counts),
            'counts' => $counts,
            'first_date' => is_string($first) ? substr($first, 0, 10) : null,
            'logs' => (int) ($logs->total ?? 0),
            'selfies' => (int) ($logs->selfies ?? 0),
            'days' => array_values($days->map(fn (AttendanceDay $day): array => $this->day($day))->all()),
        ];
    }

    /**
     * Requests the user submitted (newest first).
     *
     * @return array{count: int, items: list<array<string, mixed>>}
     */
    public function requests(User $user, ?int $limit): array
    {
        $query = EmployeeRequest::query()->ownedBy($user);
        $requests = (clone $query)
            ->with('leaveType:id,name,category')
            ->latest('created_at')
            ->when($limit !== null, fn (Builder $q) => $q->limit((int) $limit))
            ->get();

        return [
            'count' => $limit === null ? $requests->count() : $query->count(),
            'items' => array_values($requests->map(fn (EmployeeRequest $request): array => [
                'id' => $request->id,
                'number' => $request->number,
                'type' => $request->leaveType->name,
                'summary' => RequestFormatter::summary($request),
                'reason' => $request->reason,
                'status' => $request->status->value,
                'status_label' => $request->status->label(),
                'submitted_at' => $request->submitted_at?->toIso8601String(),
                'decided_at' => $request->decided_at?->toIso8601String(),
                'url' => '/pengajuan/'.$request->id,
            ])->all()),
        ];
    }

    /**
     * Approval decisions the user made (approve / reject / revision), newest first.
     *
     * @return array{count: int, items: list<array<string, mixed>>}
     */
    public function decisions(User $user, ?int $limit): array
    {
        $query = $this->queue->decidedBy($user);
        $steps = (clone $query)
            ->with(['request:id,number,user_id,leave_type_id,start_at,end_at,days,minutes,payload', 'request.user:id,name', 'request.leaveType:id,name,category'])
            ->when($limit !== null, fn (Builder $q) => $q->limit((int) $limit))
            ->get();

        return [
            'count' => $limit === null ? $steps->count() : $query->count(),
            'items' => array_values($steps->map(fn (RequestApproval $step): array => [
                'id' => $step->id,
                'request_id' => $step->request_id,
                'number' => $step->request->number,
                'requester' => $step->request->user->name,
                'type' => $step->request->leaveType->name,
                'summary' => RequestFormatter::summary($step->request),
                'decision' => $step->status->value,
                'decision_label' => $step->status->label(),
                'note' => $step->note,
                'decided_at' => $step->decided_at?->toIso8601String(),
                'url' => '/persetujuan/'.$step->request_id,
            ])->all()),
        ];
    }

    /**
     * Every attendance day of the user (export), oldest first.
     *
     * @return list<array<string, mixed>>
     */
    public function allDays(User $user): array
    {
        return array_values($this->days($user)
            ->reorder('work_date')
            ->get()
            ->map(fn (AttendanceDay $day): array => $this->day($day))
            ->all());
    }

    /**
     * Every check-in/out log of the user (export), oldest first. Selfies are
     * listed (present / deleted after retention), not embedded.
     *
     * @return list<array<string, mixed>>
     */
    public function allLogs(User $user): array
    {
        return array_values(AttendanceLog::query()
            ->where('user_id', $user->id)
            ->with('officeLocation:id,name')
            ->orderBy('occurred_at')
            ->get()
            ->map(fn (AttendanceLog $log): array => [
                'occurred_at' => OfficeClock::date($log->occurred_at).' '.OfficeClock::time($log->occurred_at),
                'type' => $log->type->label(),
                'method' => $log->method->label(),
                'location' => $log->officeLocation?->name,
                'latitude' => $log->latitude === null ? null : round($log->latitude, 6),
                'longitude' => $log->longitude === null ? null : round($log->longitude, 6),
                'accuracy_m' => $log->accuracy_m === null ? null : (int) round($log->accuracy_m),
                'distance_m' => $log->distance_m === null ? null : (int) round($log->distance_m),
                'selfie' => $log->selfie_path !== null ? 'Tersimpan' : '–',
                'flags' => $log->flags->map(fn (LogFlag $flag): string => $flag->label())->implode(', '),
                'ip_address' => $log->ip_address,
                'user_agent' => $log->user_agent,
                'device' => $log->device_fingerprint,
                'note' => $log->note,
                'manual' => $log->corrected_by !== null,
            ])
            ->all());
    }

    /**
     * Status labels for the attendance totals.
     *
     * @return array<string, string>
     */
    public static function statusLabels(): array
    {
        $labels = [];

        foreach (AttendanceStatus::cases() as $status) {
            $labels[$status->value] = $status->label();
        }

        return $labels;
    }

    /**
     * @return Builder<AttendanceDay>
     */
    private function days(User $user): Builder
    {
        return AttendanceDay::query()
            ->where('user_id', $user->id)
            ->with(['shift:id,name', 'checkInLog:id,method,office_location_id', 'checkInLog.officeLocation:id,name'])
            ->latest('work_date');
    }

    /**
     * @return array<string, mixed>
     */
    private function day(AttendanceDay $day): array
    {
        return [
            'date' => $day->work_date->toDateString(),
            'status' => $day->status->value,
            'status_label' => $day->status->label(),
            'shift' => $day->shift?->name,
            'check_in_at' => $day->check_in_at?->toIso8601String(),
            'check_out_at' => $day->check_out_at?->toIso8601String(),
            'check_in' => $day->check_in_at === null ? null : OfficeClock::time($day->check_in_at),
            'check_out' => $day->check_out_at === null ? null : OfficeClock::time($day->check_out_at),
            'method' => $day->checkInLog?->method->label(),
            'location' => $day->checkInLog?->officeLocation?->name,
            'late_minutes' => $day->late_minutes,
            'early_leave_minutes' => $day->early_leave_minutes,
            'work_minutes' => $day->work_minutes,
            'overtime_minutes' => $day->overtime_minutes,
            'note' => $day->note,
        ];
    }

    /**
     * Office-time label for an instant (exports).
     */
    public static function at(?CarbonImmutable $at): ?string
    {
        return $at === null ? null : OfficeClock::date($at).' '.OfficeClock::time($at);
    }
}
