<?php

use App\Domain\Organization\Actions\UpdateUserTheme;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\Theme;
use App\Models\User;

it('persists the given theme on the user', function () {
    $user = User::factory()->create();

    app(UpdateUserTheme::class)->handle($user, Theme::Dark);

    expect($user->refresh()->theme)->toBe(Theme::Dark);
});

it('only changes the target user', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();

    app(UpdateUserTheme::class)->handle($user, Theme::Light);

    expect($other->refresh()->theme)->toBe(Theme::System);
});

it('defaults new users to the system theme', function () {
    expect(User::factory()->create()->refresh()->theme)->toBe(Theme::System);
});

it('has Indonesian labels for every theme', function () {
    expect(Theme::System->label())->toBe('Sistem')
        ->and(Theme::Light->label())->toBe('Terang')
        ->and(Theme::Dark->label())->toBe('Gelap');
});

it('falls back to the system theme for unknown raw values', function (mixed $value, Theme $expected) {
    expect(Theme::fromValue($value))->toBe($expected);
})->with([
    ['dark', Theme::Dark],
    [Theme::Light, Theme::Light],
    ['purple', Theme::System],
    [null, Theme::System],
    [['dark'], Theme::System],
]);

it('has Indonesian labels for every role', function () {
    expect(array_map(fn (Role $role): string => $role->label(), Role::cases()))
        ->toBe(['Super Admin', 'Direksi', 'HR', 'Kepala Divisi', 'Anggota'])
        ->and(array_column(Role::cases(), 'value'))
        ->toBe(['super_admin', 'direksi', 'hr', 'kepala_divisi', 'anggota']);
});
