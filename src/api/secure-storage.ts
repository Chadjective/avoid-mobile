/**
 * A Supabase auth storage adapter backed by expo-secure-store.
 *
 * SecureStore refuses values over 2048 bytes, and a Supabase session (access
 * token + refresh token + user object) routinely exceeds that. So a value is
 * split into 1800-byte chunks: `<key>` holds the chunk count, `<key>.0`…
 * `<key>.n-1` hold the pieces. Anything the app writes here is a bearer
 * credential, which is why it is not AsyncStorage.
 */
import * as SecureStore from "expo-secure-store";

const CHUNK = 1800;

async function clearChunks(key: string, count: number): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await SecureStore.deleteItemAsync(`${key}.${i}`);
  }
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const header = await SecureStore.getItemAsync(key);
      if (header === null) return null;
      const count = Number(header);
      if (!Number.isInteger(count) || count < 0) return null;
      let out = "";
      for (let i = 0; i < count; i += 1) {
        const part = await SecureStore.getItemAsync(`${key}.${i}`);
        // A missing chunk means a torn write; treat the whole value as absent
        // rather than handing Supabase a truncated JSON blob.
        if (part === null) return null;
        out += part;
      }
      return out;
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      const previous = Number((await SecureStore.getItemAsync(key)) ?? "0");
      if (Number.isInteger(previous) && previous > 0) await clearChunks(key, previous);

      const chunks: string[] = [];
      for (let i = 0; i < value.length; i += CHUNK) {
        chunks.push(value.slice(i, i + CHUNK));
      }
      for (let i = 0; i < chunks.length; i += 1) {
        await SecureStore.setItemAsync(`${key}.${i}`, chunks[i]);
      }
      await SecureStore.setItemAsync(key, String(chunks.length));
    } catch {
      // A device with no keystore cannot persist the session; the app still
      // works for the life of the process.
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      const count = Number((await SecureStore.getItemAsync(key)) ?? "0");
      if (Number.isInteger(count) && count > 0) await clearChunks(key, count);
      await SecureStore.deleteItemAsync(key);
    } catch {
      // nothing to do
    }
  },
};
