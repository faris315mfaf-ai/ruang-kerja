/**
 * Akses sesi tersimpan (SecureStore) tanpa konteks React. Dipakai sinkron latar
 * belakang, yang berjalan di proses tanpa layar dan tidak punya SessionProvider.
 * `SessionProvider` memakai kunci yang sama sebagai satu-satunya penulis.
 */
import * as SecureStore from 'expo-secure-store';

export const KUNCI_SESI = 'rk.sesi';

export interface TokenTersimpan {
  token: string;
  /** Id pengguna (ULID) pemilik token. */
  uid: string;
}

/** Token + id pengguna dari sesi tersimpan, atau null bila belum masuk / data rusak. */
export async function bacaTokenTersimpan(): Promise<TokenTersimpan | null> {
  try {
    const mentah = await SecureStore.getItemAsync(KUNCI_SESI);
    if (!mentah) {
      return null;
    }
    const sesi = JSON.parse(mentah) as { token?: unknown; user?: { id?: unknown } };
    return typeof sesi.token === 'string' && sesi.token !== '' && typeof sesi.user?.id === 'string' && sesi.user.id !== '' ? { token: sesi.token, uid: sesi.user.id } : null;
  } catch {
    return null;
  }
}
