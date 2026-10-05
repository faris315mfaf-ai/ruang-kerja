<?php

namespace App\Domain\Attendance\Events;

use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Models\Division;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * A check-in/out was recorded. Live attendance boards of HR/Direksi
 * (`company.attendance`) and of the Kepala Divisi of the employee's division
 * or of any parent division (`division.{id}.attendance`) update from it. No location or selfie data.
 */
final class AttendanceRecorded implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public AttendanceDay $day,
        public AttendanceLog $log,
    ) {}

    /**
     * @return list<PrivateChannel>
     */
    public function broadcastOn(): array
    {
        $channels = [new PrivateChannel('company.attendance')];
        $divisionId = $this->day->user->division_id;

        // The employee's division and every parent division: a Kepala Divisi
        // also leads the sub-divisions below theirs.
        foreach ($divisionId === null ? [] : Division::withAncestorIds($divisionId) as $id) {
            $channels[] = new PrivateChannel("division.{$id}.attendance");
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'attendance.recorded';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        $user = $this->day->user;

        return [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'division_id' => $user->division_id,
            ],
            'day_id' => $this->day->id,
            'work_date' => $this->day->work_date->toDateString(),
            'type' => $this->log->type->value,
            'method' => $this->log->method->value,
            'occurred_at' => $this->log->occurred_at->toIso8601String(),
            'status' => $this->day->status->value,
            'status_label' => $this->day->status->label(),
            'late_minutes' => $this->day->late_minutes,
            'early_leave_minutes' => $this->day->early_leave_minutes,
            'is_suspicious' => $this->log->is_suspicious,
        ];
    }
}
