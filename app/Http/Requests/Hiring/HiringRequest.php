<?php

namespace App\Http\Requests\Hiring;

use App\Models\Candidate;
use App\Models\CandidateChecklistItem;
use App\Models\CandidateNote;
use App\Models\HiringPosition;
use App\Models\HiringQuestion;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

/**
 * Hiring requests: a position / candidate the user may not see answers 404
 * before validation runs, so validation errors never reveal that it exists.
 * Controllers authorize the specific ability afterwards.
 */
abstract class HiringRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        if (! $user instanceof User) {
            abort(404);
        }

        $gate = Gate::forUser($user);
        $position = $this->route('position');
        $candidate = $this->route('candidate');
        $question = $this->route('question');
        $item = $this->route('item');
        $note = $this->route('note');

        $visible = (! $position instanceof HiringPosition || $gate->allows('view', $position))
            && (! $candidate instanceof Candidate || $gate->allows('view', $candidate))
            && (! $question instanceof HiringQuestion || $gate->allows('view', $question))
            && (! $item instanceof CandidateChecklistItem || $gate->allows('view', $item))
            && (! $note instanceof CandidateNote || $gate->allows('view', $note));

        abort_unless($visible, 404);

        return true;
    }
}
