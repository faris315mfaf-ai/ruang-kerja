<?php

namespace App\Domain\Meetings\Transcripts\Exceptions;

use RuntimeException;

/**
 * The draft/transcript is not in a state that allows the action (already
 * inserted, discarded, still being summarized, minutes final). HTTP 409 with
 * the Indonesian message.
 */
final class TranscriptConflict extends RuntimeException {}
