<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Pengumuman (keputusan pemilik 6 Okt 2026): written by Direksi, HR, Super
 * Admin (everyone or chosen divisions/teams), a Kepala Divisi (the divisions
 * they lead) or a Ketua Tim (their team). Shown as banners on the dashboards
 * until dismissed (announcement_dismissals) or expired; the Inbox
 * notification stays (docs/DATABASE.md §6 announcements).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('announcements', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('company_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('author_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title', 160);
            $table->text('body');
            // all · division · team
            $table->string('audience', 20);
            // division or team ids (audience division/team), [] for all.
            $table->jsonb('target_ids')->default('[]');
            $table->timestampTz('published_at');
            $table->timestampTz('expires_at')->nullable();
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->index(['company_id', 'published_at']);
        });

        DB::statement("ALTER TABLE announcements ADD CONSTRAINT announcements_audience_check CHECK (audience IN ('all', 'division', 'team'))");
        DB::statement('ALTER TABLE announcements ADD CONSTRAINT announcements_expires_check CHECK (expires_at IS NULL OR expires_at > published_at)');
        DB::statement('CREATE INDEX announcements_target_ids_gin ON announcements USING gin (target_ids)');

        Schema::create('announcement_dismissals', function (Blueprint $table) {
            $table->foreignUlid('announcement_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('user_id')->constrained()->cascadeOnDelete();
            $table->timestampTz('dismissed_at');

            $table->primary(['announcement_id', 'user_id']);
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('announcement_dismissals');
        Schema::dropIfExists('announcements');
    }
};
