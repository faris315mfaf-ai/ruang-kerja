<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Channel-independent de-dup of scheduled reminders (review fix 3-9 #8):
     * one row per (type, subject, recipient, cycle) claimed atomically before a
     * reminder is sent, whatever channels the recipient enabled. The Inbox row
     * alone cannot be used: with in-app disabled there is none, so the overdue
     * e-mail went out every day.
     */
    public function up(): void
    {
        Schema::create('notification_dispatch_logs', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('type', 80);
            $table->ulidMorphs('subject');
            $table->foreignUlid('user_id')->constrained()->cascadeOnDelete();
            $table->string('cycle', 40);
            $table->timestampTz('created_at');

            $table->unique(['type', 'subject_type', 'subject_id', 'user_id', 'cycle'], 'notification_dispatch_logs_claim_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_dispatch_logs');
    }
};
