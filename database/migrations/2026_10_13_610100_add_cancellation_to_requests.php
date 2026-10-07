<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Who canceled a request, when and why (docs/DATABASE.md §3 requests).
 * Filled by CancelRequest (requester, before the decision; no reason) and
 * CancelApprovedRequest (HR voids an approved request; reason required).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('requests', function (Blueprint $table) {
            $table->timestampTz('canceled_at')->nullable()->after('decided_at');
            $table->foreignUlid('canceled_by_id')->nullable()->after('canceled_at')->constrained('users')->nullOnDelete();
            $table->text('cancel_reason')->nullable()->after('canceled_by_id');
        });
    }

    public function down(): void
    {
        Schema::table('requests', function (Blueprint $table) {
            $table->dropConstrainedForeignId('canceled_by_id');
            $table->dropColumn(['canceled_at', 'cancel_reason']);
        });
    }
};
