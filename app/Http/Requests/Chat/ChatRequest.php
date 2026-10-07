<?php

namespace App\Http\Requests\Chat;

use App\Models\Channel;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

/**
 * Obrolan requests: a channel (or message) the user may not read answers 404
 * before validation runs, so errors never reveal that it exists. Controllers
 * check the specific ability (post, update, delete, …) afterwards.
 */
abstract class ChatRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $channel = $this->route('channel');
        $message = $this->route('message');

        $visible = $user instanceof User
            && (! $channel instanceof Channel || Gate::forUser($user)->allows('view', $channel))
            && (! $message instanceof Message || Gate::forUser($user)->allows('view', $message));

        abort_unless($visible, 404);

        return true;
    }
}
