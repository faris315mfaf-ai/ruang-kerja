<?php

namespace App\Domain\Notifications\Contracts;

use App\Domain\Notifications\Data\WhatsAppMessage;

/**
 * Phase 2: concrete WhatsApp gateway (Meta Cloud API or a local gateway).
 * The provider decision is postponed (PRD M6); bind an implementation and set
 * NOTIFICATIONS_WHATSAPP_ENABLED=true to activate the channel.
 */
interface WhatsAppProvider
{
    /**
     * Send a message to an E.164 phone number (e.g. "+6281234567890").
     */
    public function send(string $phone, WhatsAppMessage $message): void;
}
