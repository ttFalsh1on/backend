import type { FunctionContext } from "@flex/core";
import { createSessionToken } from "./crypto.js";
import { SESSION_MS } from "./access.js";
import { generateOtpCode, hashOtp, verifyOtp, OTP_MS } from "./otp.js";
import { dispatchOtp } from "./notify.js";

type UserDoc = Record<string, unknown>;

export async function createUserSession(
  ctx: FunctionContext,
  userId: string
): Promise<string> {
  const token = createSessionToken();
  await ctx.db.insert("sessions", {
    userId,
    token,
    expiresAt: Date.now() + SESSION_MS,
  });
  return token;
}

export function publicUser(user: UserDoc) {
  return {
    _id: user._id,
    email: user.email,
    name: user.name,
    phone: user.phone ?? null,
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    twoFactorMethod: user.twoFactorMethod ?? "email",
    locale: user.locale ?? "ru",
  };
}

export async function start2faChallenge(
  ctx: FunctionContext,
  user: UserDoc
): Promise<{ requires2fa: true; loginToken: string; channel: string }> {
  const method = (user.twoFactorMethod as string) || "email";
  const channel = method === "sms" ? "sms" : "email";
  const target =
    channel === "sms"
      ? (user.phone as string | undefined)
      : (user.email as string);

  if (!target) {
    throw new Error(
      channel === "sms"
        ? "Для SMS 2FA укажите телефон в настройках"
        : "Email не найден"
    );
  }

  const code = generateOtpCode();
  const loginToken = createSessionToken();

  await ctx.db.insert("otpChallenges", {
    userId: user._id as string,
    purpose: "login",
    channel,
    target,
    codeHash: hashOtp(code),
    expiresAt: Date.now() + OTP_MS,
    loginToken,
  });

  await dispatchOtp(channel, target, code);

  return { requires2fa: true, loginToken, channel };
}

export async function complete2faLogin(
  ctx: FunctionContext,
  loginToken: string,
  code: string
): Promise<{ userId: string }> {
  const challenges = await ctx.db
    .query("otpChallenges")
    .withIndex("by_login_token", (q) => q.eq("loginToken", loginToken))
    .collect();

  const challenge = challenges[0];
  if (!challenge) throw new Error("Код истёк или не найден");
  if ((challenge.expiresAt as number) < Date.now()) {
    await ctx.db.delete("otpChallenges", challenge._id as string);
    throw new Error("Код истёк");
  }

  if (!verifyOtp(code.trim(), challenge.codeHash as string)) {
    throw new Error("Неверный код");
  }

  await ctx.db.delete("otpChallenges", challenge._id as string);
  return { userId: challenge.userId as string };
}

export async function findUserByLogin(
  ctx: FunctionContext,
  login: string,
  mode: "email" | "phone"
): Promise<UserDoc | null> {
  if (mode === "email") {
    const normalized = login.trim().toLowerCase();
    return ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();
  }

  const { normalizePhone } = await import("./phone.js");
  const phone = normalizePhone(login);
  return ctx.db
    .query("users")
    .withIndex("by_phone", (q) => q.eq("phone", phone))
    .first();
}
