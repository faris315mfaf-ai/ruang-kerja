<?php

use App\Domain\Auth\Enums\LoginMethod;
use Illuminate\Http\Request;

it('resolves the sign-in method from the declaration and remember-me', function (?LoginMethod $declared, bool $viaRemember, LoginMethod $expected) {
    expect(LoginMethod::resolve($declared, $viaRemember))->toBe($expected);
})->with([
    'google callback' => [LoginMethod::Google, false, LoginMethod::Google],
    'password' => [LoginMethod::Password, false, LoginMethod::Password],
    'demo' => [LoginMethod::Demo, false, LoginMethod::Demo],
    'remember-me recall' => [null, true, LoginMethod::Remember],
    // A recaller restore on the Google callback route must never count as Google.
    'remember-me recall on the google callback' => [LoginMethod::Google, true, LoginMethod::Remember],
    'remember-me recall on the demo route' => [LoginMethod::Demo, true, LoginMethod::Remember],
    'undeclared login is treated strictly' => [null, false, LoginMethod::Password],
]);

it('stores the declared method on the request', function () {
    $request = Request::create('/auth/google/callback');

    expect(LoginMethod::declaredFor($request))->toBeNull();

    LoginMethod::Google->declareFor($request);

    expect(LoginMethod::declaredFor($request))->toBe(LoginMethod::Google);
});

it('has Indonesian labels', function () {
    expect(LoginMethod::Google->label())->toBe('Google Workspace')
        ->and(LoginMethod::Password->label())->toBe('Email & kata sandi');
});
