<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Laravel database notifications (DATABASE.md §6) with ULID morph keys and
 * Inbox columns: archived_at, action_required/resolved_at ("Perlu tindakan")
 * and an optional subject morph for de-duplication and resolving.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type', 80);
            $table->ulidMorphs('notifiable');
            $table->jsonb('data');
            $table->nullableUlidMorphs('subject');
            $table->boolean('action_required')->default(false);
            $table->timestampTz('resolved_at')->nullable();
            $table->timestampTz('read_at')->nullable();
            $table->timestampTz('archived_at')->nullable();
            $table->timestampsTz();

            $table->index(['notifiable_id', 'created_at']);
        });

        if (DB::getDriverName() === 'pgsql') {
            // Cheap unread count for the bell (shared Inertia prop on every request).
            DB::statement('CREATE INDEX notifications_unread_index ON notifications (notifiable_id) WHERE read_at IS NULL AND archived_at IS NULL');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
