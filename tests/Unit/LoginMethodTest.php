<?php

use App\Domain\Auth\Enums\LoginMethod;

it('derives the sign-in method from the route', function (?string $route, bool $remember, LoginMethod $expected) {
    expect(LoginMethod::fromRoute($route, $remember))->toBe($expected);
})->with([
    'google callback' => ['auth.google.callback', false, LoginMethod::Google],
    'password' => ['login.store', false, LoginMethod::Password],
    'two-factor challenge' => ['two-factor.login.store', false, LoginMethod::Password],
    'demo' => ['login.demo', false, LoginMethod::Demo],
    'remember-me recall' => ['dashboard', true, LoginMethod::Remember],
    'unknown route is treated strictly' => [null, false, LoginMethod::Password],
]);

it('has Indonesian labels', function () {
    expect(LoginMethod::Google->label())->toBe('Google Workspace')
        ->and(LoginMethod::Password->label())->toBe('Email & kata sandi');
});
