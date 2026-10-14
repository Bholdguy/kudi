/**
 * Runs `run` with secret bytes that are zeroed afterwards, on success and on
 * error alike. The bytes never leave this scope: callers must not keep a
 * reference to them after `run` returns.
 */
export async function withSecretBytes<T>(
  acquire: () => Promise<Uint8Array> | Uint8Array,
  run: (secret: Uint8Array) => Promise<T> | T,
): Promise<T> {
  const secret = await acquire();
  try {
    return await run(secret);
  } finally {
    secret.fill(0);
  }
}
