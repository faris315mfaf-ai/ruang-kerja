<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Baris Bahasa Atur Ulang Kata Sandi
    |--------------------------------------------------------------------------
    |
    | Alasan yang dikembalikan oleh password broker saat percobaan mengatur
    | ulang kata sandi berhasil atau gagal.
    |
    */

    'reset' => 'Kata sandi Anda berhasil diatur ulang.',
    // Generic on purpose: never reveals whether an address is registered.
    'sent' => 'Jika email tersebut terdaftar untuk login dengan kata sandi, tautan atur ulang telah kami kirim.',
    'throttled' => 'Mohon tunggu sebentar sebelum mencoba lagi.',
    'token' => 'Token atur ulang kata sandi ini tidak valid.',
    // Same text as `token`: an unknown address must look like an invalid link.
    'user' => 'Token atur ulang kata sandi ini tidak valid.',

];
