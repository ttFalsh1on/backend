import { mutation, query, v } from "@flex/core";
import { SESSION_MS, requireAuth } from "../lib/access.js";
import { createSessionToken, hashPassword, verifyPassword } from "../lib/crypto.js";

async function createSession(ctx: { db: { insert: Function } }, userId: string) {
  const token = createSessionToken();
  await ctx.db.insert("sessions", {
    userId,
    token,
    expiresAt: Date.now() + SESSION_MS,
  });
  return token;
}

async function ensureProfileForUser(
  ctx: { db: { query: Function; insert: Function; patch: Function } },
  userId: string,
  opts: { name: string; email?: string; isGuest: boolean }
) {
  const existing = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q: { eq: (f: string, v: string) => unknown }) =>
      q.eq("userId", userId)
    )
    .first();

  if (existing) return existing;

  await ctx.db.insert("userProfiles", {
    userId,
    name: opts.name,
    email: opts.email,
    isGuest: opts.isGuest,
    isAdmin: false,
  });

  return await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q: { eq: (f: string, v: string) => unknown }) =>
      q.eq("userId", userId)
    )
    .first();
}

export const guestLogin = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await ctx.db.insert("users", {
      name: "Гость SiteForge",
      isGuest: true,
    });

    await ensureProfileForUser(ctx, userId, {
      name: "Гость SiteForge",
      isGuest: true,
    });

    const token = await createSession(ctx, userId);
    return { token };
  },
});

export const register = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
  },
  handler: async (ctx, { email, password, name }) => {
    const normalized = email.trim().toLowerCase();
    if (password.length < 8) {
      throw new Error("Пароль минимум 8 символов");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();
    if (existing) throw new Error("Email уже занят");

    const userId = await ctx.db.insert("users", {
      email: normalized,
      passwordHash: hashPassword(password),
      name: name.trim(),
      isGuest: false,
    });

    await ensureProfileForUser(ctx, userId, {
      name: name.trim(),
      email: normalized,
      isGuest: false,
    });

    const token = await createSession(ctx, userId);
    return { token };
  },
});

export const upgradeGuest = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
  },
  handler: async (ctx, { email, password, name }) => {
    const userId = requireAuth(ctx);
    const normalized = email.trim().toLowerCase();
    if (password.length < 8) {
      throw new Error("Пароль минимум 8 символов");
    }

    const user = await ctx.db.get("users", userId);
    if (!user?.isGuest) throw new Error("Доступно только для гостей");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();
    if (existing && existing._id !== userId) {
      throw new Error("Email уже занят");
    }

    await ctx.db.patch(userId, {
      email: normalized,
      passwordHash: hashPassword(password),
      name: name.trim(),
      isGuest: false,
    });

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (profile) {
      await ctx.db.patch(profile._id as string, {
        name: name.trim(),
        email: normalized,
        isGuest: false,
      });
    }

    return { ok: true };
  },
});

export const login = mutation({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, { email, password }) => {
    const normalized = email.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();

    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash as string)) {
      throw new Error("Неверный email или пароль");
    }

    const token = await createSession(ctx, user._id as string);
    return {
      token,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
      },
    };
  },
});

export const logout = mutation({
  args: {},
  handler: async (ctx) => {
    const token = ctx.auth?.token;
    if (!token) return { ok: true };

    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (session) {
      await ctx.db.delete("sessions", session._id as string);
    }
    return { ok: true };
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = ctx.auth?.userId;
    if (!userId) return null;

    const user = await ctx.db.get("users", userId);
    if (!user) return null;

    return {
      _id: user._id,
      email: user.email ?? null,
      name: user.name,
      isGuest: user.isGuest ?? false,
    };
  },
});
