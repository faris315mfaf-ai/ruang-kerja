<?php

namespace App\Domain\Devices\Enums;

/**
 * Operating system family of a registered device.
 */
enum DevicePlatform: string
{
    case Android = 'android';
    case Ios = 'ios';
    case Web = 'web';

    public function label(): string
    {
        return match ($this) {
            self::Android => 'Android',
            self::Ios => 'iOS',
            self::Web => 'Web (browser)',
        };
    }
}
