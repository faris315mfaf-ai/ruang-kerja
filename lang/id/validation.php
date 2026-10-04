<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Baris Bahasa Validasi
    |--------------------------------------------------------------------------
    |
    | Pesan galat bawaan yang dipakai oleh kelas validator. Beberapa aturan
    | memiliki beberapa versi, misalnya aturan ukuran. Silakan sesuaikan
    | setiap pesan di sini.
    |
    */

    'accepted' => ':Attribute harus disetujui.',
    'accepted_if' => ':Attribute harus disetujui bila :other adalah :value.',
    'active_url' => ':Attribute harus berupa URL yang valid.',
    'after' => ':Attribute harus berupa tanggal setelah :date.',
    'after_or_equal' => ':Attribute harus berupa tanggal setelah atau sama dengan :date.',
    'alpha' => ':Attribute hanya boleh berisi huruf.',
    'alpha_dash' => ':Attribute hanya boleh berisi huruf, angka, tanda hubung, dan garis bawah.',
    'alpha_num' => ':Attribute hanya boleh berisi huruf dan angka.',
    'any_of' => ':Attribute tidak valid.',
    'array' => ':Attribute harus berupa larik.',
    'array_keys' => ':Attribute hanya boleh berisi kunci berikut: :values.',
    'ascii' => ':Attribute hanya boleh berisi karakter alfanumerik dan simbol satu bita.',
    'base64' => ':Attribute harus berupa string Base64 yang valid.',
    'before' => ':Attribute harus berupa tanggal sebelum :date.',
    'before_or_equal' => ':Attribute harus berupa tanggal sebelum atau sama dengan :date.',
    'between' => [
        'array' => ':Attribute harus berisi antara :min sampai :max item.',
        'file' => ':Attribute harus berukuran antara :min sampai :max kilobita.',
        'numeric' => ':Attribute harus bernilai antara :min sampai :max.',
        'string' => ':Attribute harus berisi antara :min sampai :max karakter.',
    ],
    'boolean' => ':Attribute harus bernilai benar atau salah.',
    'can' => ':Attribute berisi nilai yang tidak diizinkan.',
    'confirmed' => 'Konfirmasi :attribute tidak cocok.',
    'contains' => ':Attribute tidak memuat nilai yang wajib ada.',
    'current_password' => 'Kata sandi salah.',
    'date' => ':Attribute harus berupa tanggal yang valid.',
    'date_equals' => ':Attribute harus berupa tanggal yang sama dengan :date.',
    'date_format' => ':Attribute harus sesuai dengan format :format.',
    'decimal' => ':Attribute harus memiliki :decimal angka desimal.',
    'declined' => ':Attribute harus ditolak.',
    'declined_if' => ':Attribute harus ditolak bila :other adalah :value.',
    'different' => ':Attribute dan :other harus berbeda.',
    'digits' => ':Attribute harus terdiri dari :digits digit.',
    'digits_between' => ':Attribute harus terdiri dari :min sampai :max digit.',
    'dimensions' => 'Dimensi gambar :attribute tidak valid.',
    'distinct' => ':Attribute memiliki nilai yang duplikat.',
    'doesnt_contain' => ':Attribute tidak boleh memuat salah satu dari berikut: :values.',
    'doesnt_end_with' => ':Attribute tidak boleh diakhiri dengan salah satu dari berikut: :values.',
    'doesnt_start_with' => ':Attribute tidak boleh diawali dengan salah satu dari berikut: :values.',
    'email' => ':Attribute harus berupa alamat email yang valid.',
    'encoding' => ':Attribute harus dienkode dalam :encoding.',
    'ends_with' => ':Attribute harus diakhiri dengan salah satu dari berikut: :values.',
    'enum' => ':Attribute yang dipilih tidak valid.',
    'exists' => ':Attribute yang dipilih tidak valid.',
    'extensions' => ':Attribute harus memiliki salah satu ekstensi berikut: :values.',
    'file' => ':Attribute harus berupa berkas.',
    'filled' => ':Attribute wajib memiliki nilai.',
    'gt' => [
        'array' => ':Attribute harus berisi lebih dari :value item.',
        'file' => ':Attribute harus berukuran lebih dari :value kilobita.',
        'numeric' => ':Attribute harus bernilai lebih dari :value.',
        'string' => ':Attribute harus berisi lebih dari :value karakter.',
    ],
    'gte' => [
        'array' => ':Attribute harus berisi :value item atau lebih.',
        'file' => ':Attribute harus berukuran lebih dari atau sama dengan :value kilobita.',
        'numeric' => ':Attribute harus bernilai lebih dari atau sama dengan :value.',
        'string' => ':Attribute harus berisi :value karakter atau lebih.',
    ],
    'hex_color' => ':Attribute harus berupa warna heksadesimal yang valid.',
    'image' => ':Attribute harus berupa gambar.',
    'in' => ':Attribute yang dipilih tidak valid.',
    'in_array' => ':Attribute harus ada di :other.',
    'in_array_keys' => ':Attribute harus memuat setidaknya salah satu kunci berikut: :values.',
    'integer' => ':Attribute harus berupa bilangan bulat.',
    'ip' => ':Attribute harus berupa alamat IP yang valid.',
    'ipv4' => ':Attribute harus berupa alamat IPv4 yang valid.',
    'ipv6' => ':Attribute harus berupa alamat IPv6 yang valid.',
    'json' => ':Attribute harus berupa string JSON yang valid.',
    'list' => ':Attribute harus berupa daftar.',
    'lowercase' => ':Attribute harus berupa huruf kecil.',
    'lt' => [
        'array' => ':Attribute harus berisi kurang dari :value item.',
        'file' => ':Attribute harus berukuran kurang dari :value kilobita.',
        'numeric' => ':Attribute harus bernilai kurang dari :value.',
        'string' => ':Attribute harus berisi kurang dari :value karakter.',
    ],
    'lte' => [
        'array' => ':Attribute tidak boleh berisi lebih dari :value item.',
        'file' => ':Attribute harus berukuran kurang dari atau sama dengan :value kilobita.',
        'numeric' => ':Attribute harus bernilai kurang dari atau sama dengan :value.',
        'string' => ':Attribute harus berisi :value karakter atau kurang.',
    ],
    'mac_address' => ':Attribute harus berupa alamat MAC yang valid.',
    'max' => [
        'array' => ':Attribute tidak boleh berisi lebih dari :max item.',
        'file' => ':Attribute tidak boleh berukuran lebih dari :max kilobita.',
        'numeric' => ':Attribute tidak boleh bernilai lebih dari :max.',
        'string' => ':Attribute tidak boleh berisi lebih dari :max karakter.',
    ],
    'max_digits' => ':Attribute tidak boleh memiliki lebih dari :max digit.',
    'mimes' => ':Attribute harus berupa berkas berjenis: :values.',
    'mimetypes' => ':Attribute harus berupa berkas berjenis: :values.',
    'min' => [
        'array' => ':Attribute harus berisi minimal :min item.',
        'file' => ':Attribute harus berukuran minimal :min kilobita.',
        'numeric' => ':Attribute harus bernilai minimal :min.',
        'string' => ':Attribute harus berisi minimal :min karakter.',
    ],
    'min_digits' => ':Attribute harus memiliki minimal :min digit.',
    'missing' => ':Attribute harus tidak ada.',
    'missing_if' => ':Attribute harus tidak ada bila :other adalah :value.',
    'missing_unless' => ':Attribute harus tidak ada kecuali :other adalah :value.',
    'missing_with' => ':Attribute harus tidak ada bila :values ada.',
    'missing_with_all' => ':Attribute harus tidak ada bila :values ada.',
    'multiple_of' => ':Attribute harus kelipatan dari :value.',
    'not_in' => ':Attribute yang dipilih tidak valid.',
    'not_regex' => 'Format :attribute tidak valid.',
    'numeric' => ':Attribute harus berupa angka.',
    'password' => [
        'letters' => ':Attribute harus memuat setidaknya satu huruf.',
        'mixed' => ':Attribute harus memuat setidaknya satu huruf kapital dan satu huruf kecil.',
        'numbers' => ':Attribute harus memuat setidaknya satu angka.',
        'symbols' => ':Attribute harus memuat setidaknya satu simbol.',
        'uncompromised' => ':Attribute yang Anda masukkan pernah muncul dalam kebocoran data. Silakan pilih :attribute lain.',
    ],
    'present' => ':Attribute wajib ada.',
    'present_if' => ':Attribute wajib ada bila :other adalah :value.',
    'present_unless' => ':Attribute wajib ada kecuali :other adalah :value.',
    'present_with' => ':Attribute wajib ada bila :values ada.',
    'present_with_all' => ':Attribute wajib ada bila :values ada.',
    'prohibited' => ':Attribute tidak diizinkan.',
    'prohibited_if' => ':Attribute tidak diizinkan bila :other adalah :value.',
    'prohibited_if_accepted' => ':Attribute tidak diizinkan bila :other disetujui.',
    'prohibited_if_declined' => ':Attribute tidak diizinkan bila :other ditolak.',
    'prohibited_unless' => ':Attribute tidak diizinkan kecuali :other ada di :values.',
    'prohibits' => ':Attribute melarang :other untuk diisi.',
    'regex' => 'Format :attribute tidak valid.',
    'required' => ':Attribute wajib diisi.',
    'required_array_keys' => ':Attribute harus memuat entri untuk: :values.',
    'required_if' => ':Attribute wajib diisi bila :other adalah :value.',
    'required_if_accepted' => ':Attribute wajib diisi bila :other disetujui.',
    'required_if_declined' => ':Attribute wajib diisi bila :other ditolak.',
    'required_unless' => ':Attribute wajib diisi kecuali :other ada di :values.',
    'required_with' => ':Attribute wajib diisi bila :values ada.',
    'required_with_all' => ':Attribute wajib diisi bila :values ada.',
    'required_without' => ':Attribute wajib diisi bila :values tidak ada.',
    'required_without_all' => ':Attribute wajib diisi bila tidak ada satu pun dari :values.',
    'same' => ':Attribute harus sama dengan :other.',
    'size' => [
        'array' => ':Attribute harus berisi :size item.',
        'file' => ':Attribute harus berukuran :size kilobita.',
        'numeric' => ':Attribute harus bernilai :size.',
        'string' => ':Attribute harus berisi :size karakter.',
    ],
    'starts_with' => ':Attribute harus diawali dengan salah satu dari berikut: :values.',
    'string' => ':Attribute harus berupa teks.',
    'timezone' => ':Attribute harus berupa zona waktu yang valid.',
    'unique' => ':Attribute sudah dipakai.',
    'uploaded' => ':Attribute gagal diunggah.',
    'uppercase' => ':Attribute harus berupa huruf kapital.',
    'url' => ':Attribute harus berupa URL yang valid.',
    'ulid' => ':Attribute harus berupa ULID yang valid.',
    'uuid' => ':Attribute harus berupa UUID yang valid.',

    /*
    |--------------------------------------------------------------------------
    | Baris Bahasa Validasi Kustom
    |--------------------------------------------------------------------------
    |
    | Pesan validasi kustom per atribut memakai konvensi "atribut.aturan".
    |
    */

    'custom' => [
        'attribute-name' => [
            'rule-name' => 'custom-message',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Atribut Validasi Kustom
    |--------------------------------------------------------------------------
    |
    | Mengganti placeholder :attribute dengan nama yang lebih ramah dibaca,
    | misalnya "kata sandi" alih-alih "password".
    |
    */

    'attributes' => [
        'name' => 'nama',
        'email' => 'email',
        'password' => 'kata sandi',
        'current_password' => 'kata sandi saat ini',
        'password_confirmation' => 'konfirmasi kata sandi',
        'theme' => 'tema',
        'code' => 'kode autentikasi',
        'recovery_code' => 'kode pemulihan',
        'credential' => 'kredensial passkey',
        'token' => 'token',
        'remember' => 'ingat saya',
    ],

];
