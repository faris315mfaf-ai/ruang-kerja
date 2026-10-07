<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Tanda baca komentar tugas (backlog Sprint 6 "read receipts komentar"):
 * one read pointer per person per task instead of a row per comment. A
 * comment counts as read by someone when (created_at, id) of the comment is
 * not after (last_read_at, last_read_comment_id) of their row
 * (docs/DATABASE.md §4 task_comment_reads).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('task_comment_reads', function (Blueprint $table) {
            $table->foreignUlid('task_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('user_id')->constrained()->cascadeOnDelete();
            // Newest comment seen (no FK: comments are soft deleted and the pointer
            // only orders; ties on created_at are broken by the ULID).
            $table->ulid('last_read_comment_id');
            // created_at of that comment (the read watermark).
            $table->timestampTz('last_read_at');
            // updated_at = when the pointer last moved ("dibaca pukul …").
            $table->timestampsTz();

            $table->primary(['task_id', 'user_id']);
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_comment_reads');
    }
};
