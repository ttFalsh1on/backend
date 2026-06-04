import { defineSchema, defineTable, v } from "@flex/core";

export const schema = defineSchema({
  profiles: defineTable({
    key: v.string(),
    name: v.string(),
    email: v.string(),
    bio: v.string(),
  }).index("by_key", ["key"]),
});
