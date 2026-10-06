<?php

namespace App\Http\Requests\Meetings;

use App\Models\Meeting;
use App\Models\MeetingActionItem;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

/**
 * Meeting requests: a meeting the user may not see answers 404 before
 * validation runs (existence is never revealed); a follow-up must belong to
 * that meeting. Controllers check the specific ability afterwards.
 */
abstract class MeetingRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $meeting = $this->route('meeting');
        $item = $this->route('item');

        $visible = $user instanceof User
            && (! $meeting instanceof Meeting || Gate::forUser($user)->allows('view', $meeting))
            && (! $item instanceof MeetingActionItem || ($meeting instanceof Meeting && $item->minutes->meeting_id === $meeting->id));

        abort_unless($visible, 404);

        return true;
    }

    /** Occurrence date from `?tanggal=` / `tanggal` (recurring series). */
    public function occurrenceDate(): ?string
    {
        $date = $this->input('tanggal', $this->query('tanggal'));

        return is_string($date) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) === 1 ? $date : null;
    }
}
