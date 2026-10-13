/**
 * Render sederhana `body_html` catatan berformat lengkap untuk tampilan
 * baca-saja (tanpa WebView): HTML whitelist server → blok teks (judul, paragraf,
 * butir daftar, checklist, kutipan, kode, baris tabel). Format inline (tebal,
 * warna) tidak ditampilkan — hanya teksnya; untuk tampilan lengkap buka web.
 */
export type JenisBlok = 'h1' | 'h2' | 'h3' | 'p' | 'bullet' | 'nomor' | 'todo' | 'quote' | 'code' | 'baris';

export interface Blok {
  jenis: JenisBlok;
  teks: string;
  /** Nomor urut (jenis `nomor`). */
  nomor?: number;
  selesai?: boolean;
}

const ENTITAS: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function dekode(teks: string): string {
  return teks.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (semua, kode: string) => {
    if (kode.startsWith('#x') || kode.startsWith('#X')) {
      return String.fromCodePoint(parseInt(kode.slice(2), 16));
    }
    if (kode.startsWith('#')) {
      return String.fromCodePoint(parseInt(kode.slice(1), 10));
    }
    return ENTITAS[kode.toLowerCase()] ?? semua;
  });
}

function polos(html: string): string {
  return dekode(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t]+\n/g, '\n').trim();
}

export function htmlKeBlok(html: string | null): Blok[] {
  if (html === null || html.trim() === '') {
    return [];
  }
  const blok: Blok[] = [];
  let sisa = html;
  const awal = /<(h[1-6]|p|ul|ol|blockquote|pre|table)([^>]*)>([\s\S]*?)<\/\1>/i;
  for (;;) {
    const cocok = awal.exec(sisa);
    if (!cocok) {
      break;
    }
    const tag = (cocok[1] ?? '').toLowerCase();
    const atribut = cocok[2] ?? '';
    const isi = cocok[3] ?? '';
    sisa = sisa.slice((cocok.index ?? 0) + cocok[0].length);

    if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      blok.push({ jenis: tag, teks: polos(isi) });
    } else if (tag.startsWith('h')) {
      blok.push({ jenis: 'h3', teks: polos(isi) });
    } else if (tag === 'p') {
      const teks = polos(isi);
      if (teks !== '') {
        blok.push({ jenis: 'p', teks });
      }
    } else if (tag === 'ul' || tag === 'ol') {
      const todo = /data-type=["']taskList["']/i.test(atribut);
      let no = 1;
      for (const li of isi.matchAll(/<li([^>]*)>([\s\S]*?)<\/li>/gi)) {
        const teks = polos(li[2] ?? '');
        if (todo) {
          blok.push({ jenis: 'todo', teks, selesai: /data-checked=["']true["']/i.test(li[1] ?? '') });
        } else if (tag === 'ol') {
          blok.push({ jenis: 'nomor', teks, nomor: no++ });
        } else {
          blok.push({ jenis: 'bullet', teks });
        }
      }
    } else if (tag === 'blockquote') {
      blok.push({ jenis: 'quote', teks: polos(isi) });
    } else if (tag === 'pre') {
      blok.push({ jenis: 'code', teks: polos(isi) });
    } else if (tag === 'table') {
      for (const tr of isi.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
        const sel = [...(tr[1] ?? '').matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => polos(m[1] ?? ''));
        blok.push({ jenis: 'baris', teks: sel.join('  ·  ') });
      }
    }
  }
  return blok;
}
