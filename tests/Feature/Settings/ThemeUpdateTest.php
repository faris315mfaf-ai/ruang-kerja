<?php

use App\Domain\Organization\Enums\Theme;
use App\Models\User;

it('rejects guests with 401 for JSON requests', function () {
    $this->patchJson(route('theme.update'), ['theme' => 'dark'])
        ->assertUnauthorized();
});

it('redirects guests to the login page for regular requests', function () {
    $this->patch(route('theme.update'), ['theme' => 'dark'])
        ->assertRedirect(route('login'));
});

it('saves the theme and returns 204 with the appearance cookie for JSON requests', function (Theme $theme) {
    $user = User::factory()->create();

    $response = $this->actingAs($user)
        ->patchJson(route('theme.update'), ['theme' => $theme->value]);

    $response->assertNoContent()
        ->assertPlainCookie('appearance', $theme->value);

    expect($user->refresh()->theme)->toBe($theme);
    $this->assertDatabaseHas('users', ['id' => $user->id, 'theme' => $theme->value]);
})->with([
    'system' => Theme::System,
    'light' => Theme::Light,
    'dark' => Theme::Dark,
]);

it('sets a readable, long-lived appearance cookie', function () {
    $user = User::factory()->create();

    $cookie = $this->actingAs($user)
        ->patchJson(route('theme.update'), ['theme' => 'dark'])
        ->getCookie('appearance', decrypt: false);

    expect($cookie)->not->toBeNull()
        ->and($cookie->isHttpOnly())->toBeFalse()
        ->and($cookie->getExpiresTime())->toBeGreaterThan(now()->addDays(364)->getTimestamp());
});

it('redirects back for non-JSON (Inertia) requests', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from(route('profile.edit'))
        ->patch(route('theme.update'), ['theme' => 'light'])
        ->assertRedirect(route('profile.edit'))
        ->assertPlainCookie('appearance', 'light');

    expect($user->refresh()->theme)->toBe(Theme::Light);
});

it('rejects invalid theme values with 422', function (mixed $value) {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patchJson(route('theme.update'), ['theme' => $value])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('theme');

    expect($user->refresh()->theme)->toBe(Theme::System);
})->with([
    'unknown value' => 'purple',
    'empty' => '',
    'null' => null,
    'array' => [['dark']],
]);

it('returns Indonesian validation messages', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patchJson(route('theme.update'), ['theme' => 'purple'])
        ->assertJsonValidationErrors(['theme' => 'Tema tidak valid.']);

    $this->actingAs($user)
        ->patchJson(route('theme.update'), [])
        ->assertJsonValidationErrors(['theme' => 'Pilih tema.']);
});

it('shares the authenticated user\'s theme with the root view', function () {
    $user = User::factory()->create(['theme' => Theme::Dark]);

    $this->actingAs($user)
        ->withUnencryptedCookie('appearance', 'light')
        ->get(route('dashboard'))
        ->assertOk()
        ->assertViewHas('appearance', 'dark');
});

it('shares the appearance cookie with the root view for guests', function () {
    $this->withUnencryptedCookie('appearance', 'light')
        ->get(route('login'))
        ->assertOk()
        ->assertViewHas('appearance', 'light');
});

it('falls back to system for guests with a missing or invalid cookie', function (?string $cookie) {
    $request = $cookie === null ? $this : $this->withUnencryptedCookie('appearance', $cookie);

    $request->get(route('login'))
        ->assertOk()
        ->assertViewHas('appearance', 'system');
})->with([
    'no cookie' => null,
    'invalid cookie' => 'purple',
]);
