<?php

namespace App\Domain\Notifications\Data;

/**
 * Plain-text WhatsApp message (Phase 2). Template names/params can be added
 * once a provider is chosen.
 */
final readonly class WhatsAppMessage
{
    public function __construct(
        public string $text,
        public ?string $url = null,
    ) {}
}
