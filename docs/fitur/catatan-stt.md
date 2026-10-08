# Dikte mode catat (speech-to-text) — rencana

> **Status: Rencana** (riset 9 Okt 2026) · belum ada kode · menunggu keputusan privasi pemilik (§2). Kelanjutan **mode catat** pada [catatan.md](catatan.md) §3. Indeks: [README](README.md).

## 1. Tujuan

Menambahkan **dikte** (ucapan → teks) di editor catatan, terutama saat **mode catat** berjalan, supaya notulensi bisa dibuat tanpa mengetik. Dokumen ini menyalin hasil riset pemilihan teknologi 9 Okt 2026; implementasi belum dimulai.

## 2. Keputusan yang menunggu pemilik (privasi)

Rekomendasi utama (Web Speech API, §3) selama ini mengirim **audio dikte ke server Google** — bukan server perusahaan. Sampai pengenalan on-device aktif di Chrome, suara yang didikte diproses di server pihak ketika. Pemilik harus memilih salah satu:

| Pilihan | Akibat |
|---|---|
| **a. Izinkan Web Speech API** | kualitas id-ID terbaik, nol biaya server, tetapi audio dikte lewat Google sampai on-device aktif |
| **b. Self-host only** | semua dikte memakai jalur cadangan WhisperLive (§4); suara tidak keluar dari server perusahaan, kualitas/latensi lebih rendah |

## 3. Rekomendasi utama: Web Speech API (SpeechRecognition) di klien

- **Hasil interim real-time**: teks sementara tampil selagi bicara, segmen final masuk editor.
- **Kualitas id-ID terbaik**: mesin Google, termasuk tanda baca.
- **Nol server, nol bundle**: API bawaan peramban; kode dibungkus modul dinamis kecil (~2–3 KB).
- **Peramban kantor**: Chrome/Android dominan di antara pengguna internal.
- **Arah on-device**: Chrome 139+ mulai membawa pengenalan on-device untuk Web Speech API; **id-ID ada di daftar bahasa explainer** — status sebenarnya dicek saat runtime lewat `SpeechRecognition.available()`.
- **Konsekuensi** (lihat §2): sampai on-device aktif untuk id-ID, audio dikte **lewati server Google**, bukan self-host.

## 4. Cadangan self-host

- **WhisperLive** ([github.com/collabora/WhisperLive](https://github.com/collabora/WhisperLive); MIT; ±4.300 bintang; proyek aktif) — streaming WebSocket di atas faster-whisper. Dijalankan di **server transcriber yang sudah ada** (worker notulen rapat): model `large-v3-turbo` int8, 8 vCPU tanpa GPU, batas `--max_clients 2–4`. Acuan kualitas: WER Whisper large-v3 untuk bahasa Indonesia ±7% (FLEURS).
- Alternatif: **Speaches** ([github.com/speaches-ai/speaches](https://github.com/speaches-ai/speaches)) — API kompatibel OpenAI, chunked POST; latensi lebih besar daripada WebSocket streaming WhisperLive.

## 5. Perbandingan ringkas & opsi yang gugur

| Opsi | Jalur | Catatan | Status |
|---|---|---|---|
| [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition) | klien (cloud Google → on-device di Chrome 139+) | interim real-time; mesin Google bertanda baca; nol server/bundle (~2–3 KB modul dinamis) | **Rekomendasi utama** |
| [WhisperLive](https://github.com/collabora/WhisperLive) | self-host, WebSocket + faster-whisper | di server transcriber yang sudah ada; large-v3-turbo int8, 8 vCPU, `--max_clients 2–4`; WER id ±7% FLEURS | **Cadangan** (bila self-host only) |
| [Speaches](https://github.com/speaches-ai/speaches) | self-host, API kompatibel OpenAI | chunked POST; latensi lebih besar dari WebSocket streaming | Cadangan kedua |
| [Vosk](https://github.com/alphacep/vosk-api) | self-host on-device/server | kualitas id-ID kurang, tanpa tanda baca, pengembangan melambat | Gugur |
| [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) | self-host on-device/server | model streaming Indonesia sudah tua, tanpa tanda baca | Gugur |
| Moonshine · Parakeet | on-device | tidak mendukung bahasa Indonesia | Gugur |
| whisper-web ([Transformers.js](https://github.com/huggingface/transformers.js)) | di klien (WASM) | menuntut COOP/COEP yang bentrok dengan popup Google; model kecil lebih lemah di id-ID; berat di ponsel | Gugur |
| [whisper.cpp](https://github.com/ggml-org/whisper.cpp) | self-host | tanpa WebSocket native (perlu lapisan server tambahan); menduplikasi model yang sudah ada di server transcriber | Gugur |

## 6. Sketsa integrasi (10 langkah)

1. **Keputusan pemilik** soal privasi audio dikte (§2): Google (Web Speech) atau self-host-only.
2. **Permissions-Policy**: tambah varian baru (mis. `permissions_policy_notes`) dengan `microphone=(self)` untuk rute catatan (`notes.show`). Implikasi audit **R-14** (`docs/security/AUDIT-RAPAT-2026-10.md`): mikrofon saat ini hanya diizinkan di rute rapat, dan kebijakan harus dipasang **per rute** karena Inertia berpindah halaman tanpa memuat ulang dokumen; tambahkan juga test di `SecurityHeadersTest`.
3. **Modul klien dinamis** `resources/js/features/notes/dictation/` — diimpor hanya saat dipakai, tidak membebani bundle awal editor.
4. **Implementasi Web Speech**: `lang = 'id-ID'`, `continuous`, hasil interim, mulai ulang otomatis saat mesin berhenti (`restart-on-end`), berhenti saat tab disembunyikan (`visibilitychange`).
5. **Menulis ke Tiptap**: hanya **segmen FINAL** yang disisipkan ke dokumen; interim tampil sebagai dekorasi abu-abu — jangan mengalirkan interim ke Yjs agar sesi kolaborasi tidak kebanjiran update.
6. **A11y + mode gelap + ui-shots**: label tombol dikte, indikator status merekam/mendengar, kontras terang & Malam; periksa dengan `node scripts/ui-shots.mjs /catatan/{id}`.
7. **Fallback** bila Web Speech tak tersedia (peramban lain / kebijakan mati): tombol dikte disembunyikan atau menawarkan jalur self-host.
8. (Cadangan, bila self-host dipilih) **token HMAC** khusus dikte + deploy WhisperLive di server transcriber + buka `connect-src` CSP untuk WebSocket-nya.
9. **Privasi**: isi dikte tidak boleh masuk log (aturan sama dengan token/selfie/NIK di `AGENTS.md`).
10. **Uji perangkat nyata**: Android Chrome (dan desktop Chrome/Edge), termasuk interupsi mikrofon, tab disembunyikan, dan koneksi putus.

## 7. Sumber

- MDN `SpeechRecognition` — https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
- MDN `SpeechRecognition.available()` — https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/available_static
- Explainer on-device Web Speech API (daftar bahasa) — https://github.com/WebAudio/web-speech-api/blob/main/explainers/on-device-speech-recognition.md
- Pengumuman Chrome 139 (on-device Web Speech API) — https://developer.chrome.com/blog/new-in-chrome-139
- WhisperLive — https://github.com/collabora/WhisperLive
- Speaches — https://github.com/speaches-ai/speaches
