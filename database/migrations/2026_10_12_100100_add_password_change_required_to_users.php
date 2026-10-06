<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Password sign-in for every employee (owner decision 6 Oct 2026): HR may set a
 * temporary password and require the employee to change it at the next sign-in
 * (EnsurePasswordChanged sends them to Pengaturan › Keamanan until they do).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('password_change_required')->default(false)->after('password');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('password_change_required');
        });
    }
};
