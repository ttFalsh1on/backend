import { defineSchema, defineTable, v } from "@flex/core";

const blockMeta = v.optional(
  v.object({
    href: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    slot: v.optional(v.string()),
    align: v.optional(v.string()),
  })
);

export const schema = defineSchema({
  users: defineTable({
    email: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
    name: v.string(),
    isGuest: v.boolean(),
  }).index("by_email", ["email"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
  }).index("by_token", ["token"]),

  userProfiles: defineTable({
    userId: v.id("users"),
    name: v.string(),
    email: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    isGuest: v.boolean(),
    isAdmin: v.optional(v.boolean()),
  }).index("by_userId", ["userId"]),

  cmsBlocks: defineTable({
    page: v.string(),
    key: v.string(),
    type: v.string(),
    value: v.string(),
    imageUrl: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    meta: blockMeta,
    sortOrder: v.number(),
  }).index("by_page", ["page"]),

  siteTheme: defineTable({
    key: v.string(),
    colors: v.any(),
  }).index("by_key", ["key"]),

  services: defineTable({
    slug: v.string(),
    title: v.string(),
    description: v.string(),
    price: v.string(),
    features: v.array(v.string()),
    badge: v.optional(v.string()),
    sortOrder: v.number(),
  }).index("by_sortOrder", ["sortOrder"]),

  reviews: defineTable({
    name: v.string(),
    role: v.string(),
    text: v.string(),
    rating: v.number(),
    date: v.string(),
    sortOrder: v.number(),
  }).index("by_sortOrder", ["sortOrder"]),

  orders: defineTable({
    userId: v.id("users"),
    project: v.string(),
    status: v.string(),
    dueDate: v.optional(v.string()),
    sortOrder: v.number(),
  }).index("by_user", ["userId"]),

  navItems: defineTable({
    path: v.string(),
    label: v.string(),
    icon: v.string(),
    sortOrder: v.number(),
  }).index("by_sortOrder", ["sortOrder"]),
});
