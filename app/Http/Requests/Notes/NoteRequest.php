<?php

namespace App\Http\Requests\Notes;

use App\Models\Note;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

/**
 * Catatan requests: a note the user may not open answers 404 before
 * validation runs, so errors never reveal that it exists. Controllers check
 * the specific ability (update, share, delete) afterwards.
 */
abstract class NoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $note = $this->route('note');

        abort_unless($user instanceof User && (! $note instanceof Note || Gate::forUser($user)->allows('view', $note)), 404);

        return true;
    }
}
