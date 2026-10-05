<?php

use App\Domain\Organization\Enums\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
});

const GENERIC_RESET_STATUS = 'Jika email tersebut terdaftar untuk login dengan kata sandi, tautan atur ulang telah kami kirim.';

it('sends a reset link to an active Super Admin with the generic status', function () {
    $admin = User::factory()->withRole(Role::SuperAdmin)->create(['email' => 'admin@kantor.test']);

    $this->from(route('password.request'))
        ->post(route('password.email'), ['email' => 'Admin@Kantor.test'])
        ->assertRedirect(route('password.request'))
        ->assertSessionHas('status', GENERIC_RESET_STATUS)
        ->assertSessionHasNoErrors();

    Notification::assertSentTo($admin, ResetPassword::class);
});

it('answers identically without sending anything for other accounts', function (Closure $email) {
    $address = $email();

    $this->from(route('password.request'))
        ->post(route('password.email'), ['email' => $address])
        ->assertRedirect(route('password.request'))
        ->assertSessionHas('status', GENERIC_RESET_STATUS)
        ->assertSessionHasNoErrors();

    Notification::assertNothingSent();
    expect(DB::table('password_reset_tokens')->count())->toBe(0);
})->with([
    'unknown email' => [fn () => 'siapa@kantor.test'],
    'employee (Google sign-in)' => [fn () => User::factory()->withRole(Role::Hr)->create()->email],
    'inactive super admin' => [fn () => User::factory()->withRole(Role::SuperAdmin)->inactive()->create()->email],
]);

it('hides the per-user broker throttle behind the generic status', function () {
    $admin = User::factory()->withRole(Role::SuperAdmin)->create();

    $this->post(route('password.email'), ['email' => $admin->email]);
    $this->from(route('password.request'))
        ->post(route('password.email'), ['email' => $admin->email])
        ->assertSessionHas('status', GENERIC_RESET_STATUS)
        ->assertSessionHasNoErrors();

    Notification::assertSentToTimes($admin, ResetPassword::class, 1);
});

it('throttles reset link requests per IP', function () {
    foreach (range(1, 5) as $attempt) {
        $this->post(route('password.email'), ['email' => "orang{$attempt}@kantor.test"])->assertRedirect();
    }

    $this->post(route('password.email'), ['email' => 'lagi@kantor.test'])->assertTooManyRequests();
});

it('does not reveal on the reset form whether an email exists', function () {
    $admin = User::factory()->withRole(Role::SuperAdmin)->create();

    $errors = [];

    foreach ([$admin->email, 'siapa@kantor.test'] as $email) {
        $this->from(route('password.request'))->post(route('password.update'), [
            'token' => 'invalid-token',
            'email' => $email,
            'password' => 'newpassword123',
            'password_confirmation' => 'newpassword123',
        ])->assertSessionHasErrors('email');

        $errors[] = session('errors')->first('email');
    }

    expect($errors[0])->toBe($errors[1]);
});
