<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * External guests in the video room (docs/sesi/rapat-tamu-eksternal.md,
 * docs/fitur/rapat-kalender.md §6a): a guest is a meeting_participants row with
 * `email` set (no account). Each guest has a personal link /tamu/{token}; the
 * token is NEVER stored — it is HMAC(APP_KEY, id|link_nonce), so the organizer
 * can copy it again, and `link_token_hash` (sha256) only serves the lookup.
 * Rotating the link = new nonce. The waiting room ("ruang tunggu") state is
 * kept for ONE occurrence date at a time (`lobby_occurrence_date`): a series
 * needs a fresh admission each date. History lives in audit_logs.
 *
 * meeting_attendances learns to describe guests (no user): participant_id +
 * guest_name snapshot.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('meeting_participants', function (Blueprint $table) {
            // Name the organizer pre-filled or the guest typed in the waiting room.
            $table->string('guest_name', 80)->nullable();
            $table->string('link_nonce', 32)->nullable();
            $table->char('link_token_hash', 64)->nullable();
            $table->timestampTz('link_expires_at')->nullable();
            $table->timestampTz('link_rotated_at')->nullable();

            $table->string('lobby_status', 10)->default('none');
            $table->date('lobby_occurrence_date')->nullable();
            $table->timestampTz('lobby_requested_at')->nullable();
            $table->unsignedSmallInteger('lobby_requests')->default(0);
            $table->string('lobby_ip', 45)->nullable();
            $table->timestampTz('admitted_at')->nullable();
            $table->foreignUlid('admitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('denied_at')->nullable();
            $table->foreignUlid('denied_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('removed_at')->nullable();
            $table->foreignUlid('removed_by')->nullable()->constrained('users')->nullOnDelete();
            // First LiveKit token of the current admission (audit `meeting.guest_joined`).
            $table->timestampTz('joined_at')->nullable();
        });

        DB::statement("ALTER TABLE meeting_participants ADD CONSTRAINT meeting_participants_lobby_check CHECK (lobby_status IN ('none', 'waiting', 'admitted', 'denied', 'removed'))");
        DB::statement('CREATE UNIQUE INDEX meeting_participants_link_hash_unique ON meeting_participants (link_token_hash) WHERE link_token_hash IS NOT NULL');
        DB::statement("CREATE INDEX meeting_participants_lobby_index ON meeting_participants (meeting_id, lobby_occurrence_date) WHERE lobby_status = 'waiting'");

        Schema::table('meeting_attendances', function (Blueprint $table) {
            $table->foreignUlid('participant_id')->nullable()->constrained('meeting_participants')->nullOnDelete();
            // "Nama (Tamu)" as signed into the LiveKit token.
            $table->string('guest_name', 100)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('meeting_attendances', function (Blueprint $table) {
            $table->dropConstrainedForeignId('participant_id');
            $table->dropColumn('guest_name');
        });

        DB::statement('DROP INDEX IF EXISTS meeting_participants_lobby_index');
        DB::statement('DROP INDEX IF EXISTS meeting_participants_link_hash_unique');
        DB::statement('ALTER TABLE meeting_participants DROP CONSTRAINT IF EXISTS meeting_participants_lobby_check');

        Schema::table('meeting_participants', function (Blueprint $table) {
            $table->dropConstrainedForeignId('admitted_by');
            $table->dropConstrainedForeignId('denied_by');
            $table->dropConstrainedForeignId('removed_by');
            $table->dropColumn([
                'guest_name', 'link_nonce', 'link_token_hash', 'link_expires_at', 'link_rotated_at',
                'lobby_status', 'lobby_occurrence_date', 'lobby_requested_at', 'lobby_requests', 'lobby_ip',
                'admitted_at', 'denied_at', 'removed_at', 'joined_at',
            ]);
        });
    }
};
