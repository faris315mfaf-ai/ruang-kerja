<?php

namespace App\Http\Resources;

use App\Models\User;

/**
 * Minimal public person shape (id, name, avatar) shared by task screens.
 */
final class PersonResource
{
    /**
     * @return array{id: string, name: string, avatar: string|null}
     */
    public static function from(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'avatar' => $user->avatar_url,
        ];
    }
}
