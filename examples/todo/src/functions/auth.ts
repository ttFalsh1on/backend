import { mutation, query, v } from "@flex/core";
import { hashPassword, verifyPassword, createSessionToken } from "../lib/crypto.js";
import { SESSION_MS, requireAuth } from "../lib/access.js";

export const register = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
  },
  handler: async (ctx, { email, password, name }) => {
    const normalized = email.trim().toLowerCase();
    if (password.length < 6) {
      throw new Error("Пароль минимум 6 символов");
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
    });

    const token = createSessionToken();
    await ctx.db.insert("sessions", {
      userId,
      token,
      expiresAt: Date.now() + SESSION_MS,
    });

    return {
      token,
      user: { _id: userId, email: normalized, name: name.trim() },
    };
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

    if (!user) {
      throw new Error("Аккаунт не найден. Сначала зарегистрируйтесь.");
    }
    if (!verifyPassword(password, user.passwordHash as string)) {
      throw new Error("Неверный пароль");
    }

    const token = createSessionToken();
    await ctx.db.insert("sessions", {
      userId: user._id as string,
      token,
      expiresAt: Date.now() + SESSION_MS,
    });

    const projects = await ctx.db
      .query("projectMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id as string))
      .collect();

    return {
      token,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
      },
      projectIds: projects.map((p) => p.projectId),
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
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
      },
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
