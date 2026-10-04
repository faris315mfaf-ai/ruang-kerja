<?php

use App\Models\User;
use Illuminate\Support\Facades\Route;
use Laravel\Fortify\Features;

it('does not enable the Fortify registration feature', function () {
    expect(Features::enabled(Features::registration()))->toBeFalse()
        ->and(Route::has('register'))->toBeFalse()
        ->and(Route::has('register.store'))->toBeFalse();
});

it('returns 404 for the registration page', function () {
    $this->get('/register')->assertNotFound();
});

it('does not create a user when posting to /register', function () {
    $this->post('/register', [
        'name' => 'Penyusup',
        'email' => 'penyusup@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ])->assertNotFound();

    $this->assertGuest();
    expect(User::query()->where('email', 'penyusup@example.com')->exists())->toBeFalse()
        ->and(User::query()->count())->toBe(0);
});
