<?php

use App\Models\User;
use Illuminate\Support\Facades\Route;

it('limits login attempts to 10 per minute per IP', function () {
    foreach (range(1, 10) as $attempt) {
        $this->post(route('login.store'), [
            'email' => "orang{$attempt}@example.test",
            'password' => 'salah',
        ])->assertStatus(302);
    }

    $this->post(route('login.store'), [
        'email' => 'orang11@example.test',
        'password' => 'salah',
    ])->assertTooManyRequests();

    // Another IP is not affected.
    $this->withServerVariables(['REMOTE_ADDR' => '10.1.2.3'])
        ->post(route('login.store'), ['email' => 'orang1@example.test', 'password' => 'salah'])
        ->assertStatus(302);
});

it('limits login attempts to 5 per minute per email and IP', function () {
    $user = User::factory()->create();

    foreach (range(1, 5) as $attempt) {
        $this->post(route('login.store'), ['email' => $user->email, 'password' => 'salah'])->assertStatus(302);
    }

    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'salah'])->assertTooManyRequests();
});

it('applies the login limiter to the demo login', function () {
    expect(Route::getRoutes()->getByName('login.demo')?->gatherMiddleware())->toContain('throttle:login');
});

it('limits check-in to 6 per minute per user', function () {
    Route::post('_test/check-in', fn () => 'ok')->middleware(['web', 'auth', 'throttle:check-in']);

    $user = User::factory()->create();
    $other = User::factory()->create();

    foreach (range(1, 6) as $attempt) {
        $this->actingAs($user)->post('_test/check-in')->assertOk();
    }

    $this->actingAs($user)->post('_test/check-in')->assertTooManyRequests();
    $this->actingAs($other)->post('_test/check-in')->assertOk();
});

it('limits the API to 120 requests per minute', function () {
    Route::get('_test/api', fn () => ['ok' => true])->middleware('throttle:api');

    foreach (range(1, 120) as $attempt) {
        $this->getJson('_test/api')->assertOk();
    }

    $this->getJson('_test/api')->assertTooManyRequests();
});
