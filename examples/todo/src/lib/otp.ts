import { randomInt, scryptSync, timingSafeEqual } from "node:crypto";

const OTP_MS = 10 * 60 * 1000;

export function generateOtpCode(): string {
  return String(randomInt(100000, 999999));
}

export function hashOtp(code: string): string {
  const salt = "flex-otp";
  return scryptSync(code, salt, 32).toString("hex");
}

export function verifyOtp(code: string, stored: string): boolean {
  const derived = scryptSync(code, "flex-otp", 32);
  const expected = Buffer.from(stored, "hex");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

export { OTP_MS };
