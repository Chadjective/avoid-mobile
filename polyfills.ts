/**
 * Runtime polyfills that must load before anything else — including
 * expo-router's entry, which pulls in the app tree.
 *
 * `@solana/web3.js` and `@supabase/supabase-js` both assume a browser or Node
 * runtime. Hermes is neither: it has no `crypto.getRandomValues` and no
 * global `Buffer`. Importing them lazily is not enough, because module-level
 * code in web3.js touches both, so the shims go in the entry file
 * (index.ts → this module → expo-router/entry).
 */
import "react-native-get-random-values";
import { Buffer } from "buffer";

const globals = globalThis as Record<string, unknown>;

if (typeof globals.Buffer === "undefined") {
  globals.Buffer = Buffer;
}

// web3.js reads process.env.NODE_ENV in a couple of places; Hermes has a
// `process` shim but not always an `env` on it.
const proc = globals.process as { env?: unknown } | undefined;
if (proc && typeof proc.env === "undefined") {
  proc.env = {};
}
