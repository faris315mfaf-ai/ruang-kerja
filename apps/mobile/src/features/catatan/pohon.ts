/** Utilitas pohon catatan: ratakan, hitung isi, daftar folder tujuan, ringkas teks. */
import type { PohonNode } from '@/api/catatan';
import { waktuRelatif } from '@/lib/format';

export interface BarisPohon {
  node: PohonNode;
  depth: number;
  /** Jumlah turunan langsung (folder: "N item"). */
  jumlahAnak: number;
}

/** Semua turunan (rekursif) dari sebuah simpul. */
export function jumlahTurunan(node: PohonNode): number {
  return node.children.reduce((total, anak) => total + 1 + jumlahTurunan(anak), 0);
}

/** Jumlah catatan (bukan folder) dalam pohon — "6 catatan". */
export function hitungCatatan(tree: PohonNode[]): number {
  return tree.reduce((total, n) => total + (n.kind === 'note' ? 1 : 0) + hitungCatatan(n.children), 0);
}

/** Pohon → baris datar; anak hanya ikut bila simpulnya terbuka. */
export function ratakan(tree: PohonNode[], tertutup: ReadonlySet<string>, depth = 0): BarisPohon[] {
  const hasil: BarisPohon[] = [];
  for (const node of tree) {
    hasil.push({ node, depth, jumlahAnak: node.children.length });
    if (node.children.length > 0 && !tertutup.has(node.id)) {
      hasil.push(...ratakan(node.children, tertutup, depth + 1));
    }
  }
  return hasil;
}

export function cariNode(tree: PohonNode[], id: string): PohonNode | null {
  for (const node of tree) {
    if (node.id === id) {
      return node;
    }
    const anak = cariNode(node.children, id);
    if (anak !== null) {
      return anak;
    }
  }
  return null;
}

/** Id simpul beserta seluruh turunannya (tujuan pindah tidak boleh ke dalam dirinya). */
export function idTurunan(node: PohonNode): Set<string> {
  const ids = new Set<string>([node.id]);
  for (const anak of node.children) {
    for (const id of idTurunan(anak)) {
      ids.add(id);
    }
  }
  return ids;
}

export interface TujuanPindah {
  /** null = tingkat atas. */
  id: string | null;
  label: string;
  depth: number;
}

/**
 * Tujuan pindah: "Tingkat atas" + semua folder (bukan simpul itu sendiri
 * ataupun turunannya). Folder hanya boleh di tingkat atas/di dalam folder —
 * folder lain tidak ditawarkan sebagai induk catatan folder.
 */
export function daftarTujuan(tree: PohonNode[], simpul: PohonNode): TujuanPindah[] {
  const larang = idTurunan(simpul);
  const hasil: TujuanPindah[] = [{ id: null, label: 'Tingkat atas (tanpa folder)', depth: 0 }];
  const jelajah = (nodes: PohonNode[], depth: number): void => {
    for (const n of nodes) {
      if (n.kind === 'folder' && !larang.has(n.id)) {
        hasil.push({ id: n.id, label: `${n.title} (folder)`, depth });
        jelajah(n.children, depth + 1);
      }
    }
  };
  jelajah(tree, 0);
  return hasil;
}

/** "Maya Lestari" → "Maya". */
export function namaDepan(nama: string | null): string | null {
  if (nama === null || nama.trim() === '') {
    return null;
  }
  return nama.trim().split(/\s+/)[0] ?? null;
}

/** "Diubah 2 jam lalu · Sari" */
export function infoDiubah(node: { updated_at: string | null; penyunting: string | null; penulis: string | null }): string {
  const siapa = namaDepan(node.penyunting ?? node.penulis);
  const waktu = node.updated_at ? `Diubah ${waktuRelatif(node.updated_at)}` : 'Belum diubah';
  return siapa ? `${waktu} · ${siapa}` : waktu;
}

export function labelItem(n: number): string {
  return `${n} item`;
}
