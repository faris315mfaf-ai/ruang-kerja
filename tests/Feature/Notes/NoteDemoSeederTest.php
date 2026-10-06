<?php

use App\Domain\Notes\Enums\NoteAccess;
use App\Models\Note;
use App\Models\NoteShare;
use App\Models\NoteVersion;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\NoteDemoSeeder;

it('seeds demo notes once, with a restricted note shared with HR only', function () {
    $this->seed(DatabaseSeeder::class);
    $this->seed(NoteDemoSeeder::class);

    $kadiv = User::query()->where('email', 'kadiv@demo.test')->firstOrFail();
    $hr = User::query()->where('email', 'hr@demo.test')->firstOrFail();
    $direksi = User::query()->where('email', 'direksi@demo.test')->firstOrFail();
    $anggota = User::query()->where('email', 'anggota@demo.test')->firstOrFail();
    $restricted = Note::query()->where('access', NoteAccess::Restricted)->sole();

    expect(Note::query()->count())->toBe(14)
        ->and(Note::query()->where('kind', 'folder')->count())->toBe(1)
        ->and(NoteVersion::query()->count())->toBe(2)
        ->and(NoteShare::query()->count())->toBe(2)
        ->and(Note::query()->visibleTo($hr)->whereKey($restricted->id)->exists())->toBeTrue()
        ->and(Note::query()->visibleTo($kadiv)->whereKey($restricted->id)->exists())->toBeTrue()
        ->and(Note::query()->visibleTo($direksi)->whereKey($restricted->id)->exists())->toBeFalse()
        ->and(Note::query()->visibleTo($anggota)->whereKey($restricted->id)->exists())->toBeFalse()
        // Dimas' personal folder stays his own.
        ->and(Note::query()->visibleTo($hr)->where('title', 'Draf sambutan peluncuran')->exists())->toBeFalse()
        ->and(Note::query()->visibleTo($kadiv)->where('title', 'Draf sambutan peluncuran')->exists())->toBeTrue();
});
