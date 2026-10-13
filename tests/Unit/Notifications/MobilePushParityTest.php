<?php

use App\Domain\Notifications\Enums\AndroidChannel;
use App\Domain\Notifications\Enums\NotificationType;

/*
| Aplikasi Android membuat saluran notifikasi dari salinan bawaan
| (apps/mobile/src/features/notifikasi/push/kanal.ts). Tes ini mengunci
| salinan itu pada enum server AndroidChannel, dan memastikan setiap
| NotificationType punya tepat satu saluran serta tampilan di aplikasi.
| Pemeriksaan sisi aplikasi (muatan push, rute tujuan): `npm run test:push`
| di apps/mobile.
*/

/** @return array<string, array{id: string, name: string, importance: string, lockscreen: string, mutable: bool}> */
function appChannels(): array
{
    $source = file_get_contents(dirname(__DIR__, 3).'/apps/mobile/src/features/notifikasi/push/kanal.ts');
    preg_match_all(
        "/\{ id: '(rk_[a-z]+)', name: '([^']+)', importance: '([a-z]+)', lockscreen: '([a-z]+)', mutable: (true|false) \}/",
        (string) $source,
        $matches,
        PREG_SET_ORDER,
    );

    $channels = [];
    foreach ($matches as $m) {
        $channels[$m[1]] = ['id' => $m[1], 'name' => $m[2], 'importance' => $m[3], 'lockscreen' => $m[4], 'mutable' => $m[5] === 'true'];
    }

    return $channels;
}

it('keeps the app bundled channel list identical to the AndroidChannel enum', function () {
    $server = collect(AndroidChannel::definitions())
        ->mapWithKeys(fn (array $c) => [$c['id'] => ['id' => $c['id'], 'name' => $c['name'], 'importance' => $c['importance'], 'lockscreen' => $c['lockscreen'], 'mutable' => $c['mutable']]])
        ->all();

    expect(appChannels())->toBe($server);
});

it('maps every notification type to exactly one channel the app knows', function () {
    $appIds = array_keys(appChannels());
    $seen = [];

    foreach (NotificationType::cases() as $type) {
        $channel = AndroidChannel::forType($type);
        $seen[$type->value] = $channel->value;

        expect($appIds)->toContain($channel->value);
    }

    // The definitions() catalogue lists each type under one channel only.
    $listed = collect(AndroidChannel::definitions())->pluck('types')->flatten()->all();
    expect($listed)->toHaveCount(count(NotificationType::cases()))
        ->and(array_unique($listed))->toHaveCount(count($listed))
        ->and(array_keys($seen))->toEqualCanonicalizing($listed);
});

it('has a display entry (icon + description) for every user-facing channel', function () {
    $display = (string) file_get_contents(dirname(__DIR__, 3).'/apps/mobile/src/features/notifikasi/saluran.ts');

    foreach (AndroidChannel::cases() as $channel) {
        if ($channel === AndroidChannel::Sinkron) {
            continue; // technical channel, hidden from the list
        }

        expect($display)->toContain($channel->value.':');
    }
});
