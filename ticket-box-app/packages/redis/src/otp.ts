import { getRedisClient } from "./client.js";

const OTP_PREFIX = "otp:";
const COOLDOWN_PREFIX = "otp:cooldown:";

export async function setOtp(
  email: string,
  code: string,
  ttl = 300,
): Promise<void> {
  const client = getRedisClient();
  if (!client) return;
  await client.set(`${OTP_PREFIX}${email}`, code, "EX", ttl);
}

export async function getOtp(email: string): Promise<string | null> {
  const client = getRedisClient();
  if (!client) return null;
  return client.get(`${OTP_PREFIX}${email}`);
}

export async function deleteOtp(email: string): Promise<void> {
  const client = getRedisClient();
  if (!client) return;
  await client.del(`${OTP_PREFIX}${email}`);
}

/** Returns true if resend cooldown is still active (must wait). */
export async function checkResendCooldown(email: string): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;
  const exists = await client.exists(`${COOLDOWN_PREFIX}${email}`);
  return exists === 1;
}

export async function setResendCooldown(
  email: string,
  ttl = 60,
): Promise<void> {
  const client = getRedisClient();
  if (!client) return;
  await client.set(`${COOLDOWN_PREFIX}${email}`, "1", "EX", ttl);
}
