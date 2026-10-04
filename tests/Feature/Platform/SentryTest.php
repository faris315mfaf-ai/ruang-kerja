<?php

use Sentry\SentrySdk;

it('keeps Sentry disabled while SENTRY_LARAVEL_DSN is empty', function () {
    expect(config('sentry.dsn'))->toBeEmpty()
        ->and(config('sentry.send_default_pii'))->toBeFalse()
        ->and(SentrySdk::getCurrentHub()->getClient()?->getOptions()->getDsn())->toBeNull();
});
