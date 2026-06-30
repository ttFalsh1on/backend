import { mutation, query, v } from "@flex/core";
import { hashPassword, verifyPassword } from "../lib/crypto.js";
import { requireAuth } from "../lib/access.js";
import { normalizePhone } from "../lib/phone.js";
import {
  createUserSession,
  publicUser,
  start2faChallenge,
  complete2faLogin,
  findUserByLogin,
} from "../lib/authSession.js";

async function loginResult(ctx: Parameters<typeof createUserSession>[0], user: Record<string, unknown>) {
  if (user.twoFactorEnabled) {
    return start2faChallenge(ctx, user);
  }
  const token = await createUserSession(ctx, user._id as string);
  return { token, user: publicUser(user) };
}

export const register = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, { email, password, name, phone }) => {
    const normalized = email.trim().toLowerCase();
    if (password.length < 6) {
      throw new Error("Пароль минимум 6 символов");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();
    if (existing) throw new Error("Email уже занят");

    let normalizedPhone: string | undefined;
    if (phone?.trim()) {
      normalizedPhone = normalizePhone(phone);
      const phoneTaken = await ctx.db
        .query("users")
        .withIndex("by_phone", (q) => q.eq("phone", normalizedPhone!))
        .first();
      if (phoneTaken) throw new Error("Телефон уже занят");
    }

    const userId = await ctx.db.insert("users", {
      email: normalized,
      passwordHash: hashPassword(password),
      name: name.trim(),
      phone: normalizedPhone,
      twoFactorEnabled: false,
      twoFactorMethod: "email",
      locale: "ru",
    });

    const token = await createUserSession(ctx, userId);
    const user = await ctx.db.get("users", userId);

    return {
      token,
      user: publicUser(user!),
    };
  },
});

export const login = mutation({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, { email, password }) => {
    const user = await findUserByLogin(ctx, email, "email");
    if (!user) {
      throw new Error("Аккаунт не найден. Сначала зарегистрируйтесь.");
    }
    if (!verifyPassword(password, user.passwordHash as string)) {
      throw new Error("Неверный пароль");
    }
    return loginResult(ctx, user);
  },
});

export const loginByPhone = mutation({
  args: { phone: v.string(), password: v.string() },
  handler: async (ctx, { phone, password }) => {
    const user = await findUserByLogin(ctx, phone, "phone");
    if (!user) {
      throw new Error("Аккаунт с этим телефоном не найден");
    }
    if (!verifyPassword(password, user.passwordHash as string)) {
      throw new Error("Неверный пароль");
    }
    return loginResult(ctx, user);
  },
});

export const verify2fa = mutation({
  args: { loginToken: v.string(), code: v.string() },
  handler: async (ctx, { loginToken, code }) => {
    const { userId } = await complete2faLogin(ctx, loginToken, code);
    const user = await ctx.db.get("users", userId);
    if (!user) throw new Error("Пользователь не найден");
    const token = await createUserSession(ctx, userId);
    return { token, user: publicUser(user) };
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
    const userId = requireAuth(ctx);
    const user = await ctx.db.get("users", userId);
    if (!user) throw new Error("Пользователь не найден");

    const memberships = await ctx.db
      .query("projectMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const projects = [];
    for (const m of memberships) {
      const p = await ctx.db.get("projects", m.projectId as string);
      if (p) {
        projects.push({
          _id: p._id,
          name: p.name,
          slug: p.slug,
          role: m.role,
        });
      }
    }

    return {
      user: publicUser(user),
      projects,
      activeProjectId: ctx.auth?.projectId ?? null,
    };
  },
});

export const changePassword = mutation({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, { currentPassword, newPassword }) => {
    const userId = requireAuth(ctx);
    const user = await ctx.db.get("users", userId);
    if (!user) throw new Error("Пользователь не найден");

    if (!verifyPassword(currentPassword, user.passwordHash as string)) {
      throw new Error("Неверный текущий пароль");
    }
    if (newPassword.length < 6) {
      throw new Error("Новый пароль минимум 6 символов");
    }

    await ctx.db.patch("users", userId, {
      passwordHash: hashPassword(newPassword),
    });

    return { ok: true };
  },
});

export const updateSettings = mutation({
  args: {
    locale: v.optional(v.string()),
    twoFactorEnabled: v.optional(v.boolean()),
    twoFactorMethod: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = requireAuth(ctx);
    const user = await ctx.db.get("users", userId);
    if (!user) throw new Error("Пользователь не найден");

    const patch: Record<string, unknown> = {};

    if (args.locale === "ru" || args.locale === "en") {
      patch.locale = args.locale;
    }

    if (args.phone !== undefined) {
      if (!args.phone.trim()) {
        patch.phone = undefined;
      } else {
        const normalizedPhone = normalizePhone(args.phone);
        const taken = await ctx.db
          .query("users")
          .withIndex("by_phone", (q) => q.eq("phone", normalizedPhone))
          .first();
        if (taken && taken._id !== userId) {
          throw new Error("Телефон уже занят");
        }
        patch.phone = normalizedPhone;
      }
    }

    if (args.twoFactorMethod === "email" || args.twoFactorMethod === "sms") {
      patch.twoFactorMethod = args.twoFactorMethod;
    }

    if (typeof args.twoFactorEnabled === "boolean") {
      if (args.twoFactorEnabled) {
        const method = (args.twoFactorMethod ??
          user.twoFactorMethod ??
          "email") as string;
        if (method === "sms" && !user.phone && !patch.phone) {
          throw new Error("Добавьте телефон для SMS 2FA");
        }
      }
      patch.twoFactorEnabled = args.twoFactorEnabled;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch("users", userId, patch);
    }

    const updated = await ctx.db.get("users", userId);
    return { user: publicUser(updated!) };
  },
});
