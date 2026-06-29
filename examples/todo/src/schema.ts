import { defineSchema, defineTable, v } from "@flex/core";

export const schema = defineSchema({
  users: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    name: v.string(),
  }).index("by_email", ["email"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
  }).index("by_token", ["token"]),

  projects: defineTable({
    name: v.string(),
    slug: v.string(),
    ownerId: v.id("users"),
  })
    .index("by_owner", ["ownerId"])
    .index("by_slug_owner", ["slug", "ownerId"]),

  projectMembers: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    role: v.string(),
  })
    .index("by_project_user", ["projectId", "userId"])
    .index("by_user", ["userId"]),

  projectTables: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    fieldsJson: v.string(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_name", ["projectId", "name"]),

  projectFunctions: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    kind: v.string(),
    argsJson: v.string(),
    tableId: v.optional(v.string()),
    operation: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_project_name", ["projectId", "name"]),

  dynamicRows: defineTable({
    projectId: v.id("projects"),
    tableId: v.id("projectTables"),
    dataJson: v.string(),
  })
    .index("by_table", ["tableId"])
    .index("by_project", ["projectId"]),
});
