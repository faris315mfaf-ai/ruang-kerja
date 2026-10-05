<?php

namespace App\Domain\Notifications\Support;

use App\Domain\Notifications\Contracts\WhatsAppProvider;
use App\Domain\Notifications\Data\WhatsAppMessage;

/**
 * Placeholder provider: drops every message. Phase 2 replaces the binding.
 */
final class NullWhatsAppProvider implements WhatsAppProvider
{
    public function send(string $phone, WhatsAppMessage $message): void
    {
        // Intentionally empty: WhatsApp is not active in Phase 1.
    }
}
