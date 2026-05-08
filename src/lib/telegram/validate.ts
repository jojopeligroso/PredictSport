import { createHmac, timingSafeEqual } from "crypto";

/**
 * Validate the X-Telegram-Bot-Api-Secret-Token header on incoming webhook requests.
 *
 * When we call setWebhook with a `secret_token`, Telegram includes it verbatim
 * in this header on every POST. We compare using timingSafeEqual to prevent
 * timing side-channels.
 *
 * @see https://core.telegram.org/bots/api#setwebhook
 */
export function validateWebhookSecret(
  headerValue: string | null,
  expectedSecret: string
): boolean {
  if (!headerValue || !expectedSecret) return false;

  // Constant-time comparison to prevent timing attacks.
  // Both strings must be the same length for timingSafeEqual, so we HMAC both
  // with a fixed key and compare the digests.
  const key = "webhook-compare";
  const a = createHmac("sha256", key).update(headerValue).digest();
  const b = createHmac("sha256", key).update(expectedSecret).digest();

  // crypto.timingSafeEqual requires equal-length buffers — HMAC digests are
  // always 32 bytes, so this is guaranteed.
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Validate Telegram Mini App initData.
 *
 * The initData query string is signed by Telegram using HMAC-SHA256.
 * We verify the signature to confirm the data genuinely came from Telegram
 * and has not been tampered with.
 *
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * @param initData  - The raw query string from window.Telegram.WebApp.initData
 * @param botToken  - Your bot token (NEVER expose client-side)
 * @param maxAgeSeconds - Maximum age of initData before it's considered expired (replay protection)
 * @returns The parsed data entries if valid, or null if validation fails
 */
export function validateInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 300
): Record<string, string> | null {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;

  // 1. Extract auth_date and check for replay attacks
  const authDate = params.get("auth_date");
  if (!authDate) return null;

  const authTimestamp = parseInt(authDate, 10);
  if (isNaN(authTimestamp)) return null;

  const now = Math.floor(Date.now() / 1000);
  if (now - authTimestamp > maxAgeSeconds) return null;

  // 2. Build the data-check-string: sorted key=value pairs, excluding "hash"
  const entries: [string, string][] = [];
  params.forEach((value, key) => {
    if (key !== "hash") {
      entries.push([key, value]);
    }
  });
  entries.sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n");

  // 3. Compute HMAC-SHA256
  //    secret_key = HMAC-SHA256("WebAppData", bot_token)
  //    hash       = HMAC-SHA256(secret_key, data_check_string)
  const secretKey = createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const computedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  // 4. Constant-time comparison
  const a = createHmac("sha256", "compare").update(computedHash).digest();
  const b = createHmac("sha256", "compare").update(hash).digest();

  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  // 5. Return parsed entries (caller extracts user, chat_type, etc.)
  const result: Record<string, string> = {};
  entries.forEach(([k, v]) => {
    result[k] = v;
  });
  return result;
}
