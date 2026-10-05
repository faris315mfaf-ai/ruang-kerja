<?php

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

it('lets a user subscribe only to their own private user channel', function () {
    $alice = User::factory()->create();
    $bob = User::factory()->create();

    $callback = Broadcast::driver()->getChannels()->get('App.Models.User.{id}');

    expect($callback)->toBeCallable()
        ->and($callback($alice, $alice->id))->toBeTrue()
        ->and($callback($alice, $bob->id))->toBeFalse();
});
