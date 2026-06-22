import type { IndexDefinition, SchemaDefinition, TableDefinition, Validator } from "./types.js";

export function defineTable<T extends Record<string, Validator>>(
  fields: T
): TableBuilder<T> {
  return new TableBuilder(fields);
}

class TableBuilder<T extends Record<string, Validator>> {
  private fields: T;
  private indexes: IndexDefinition[] = [];

  constructor(fields: T) {
    this.fields = fields;
  }

  index(name: string, fields: (keyof T & string)[]): this {
    this.indexes.push({ name, fields: fields as string[] });
    return this;
  }

  /** Finalize table without extra indexes */
  build(name: string): TableDefinition {
    return {
      name,
      fields: this.fields as Record<string, Validator>,
      indexes: this.indexes,
    };
  }
}

export function defineSchema<
  T extends Record<string, TableDefinition | TableBuilder<Record<string, Validator>>>
>(tables: T): SchemaDefinition {
  const result: Record<string, TableDefinition> = {};

  for (const [tableName, def] of Object.entries(tables)) {
    if (def instanceof TableBuilder) {
      result[tableName] = def.build(tableName);
    } else {
      result[tableName] = { ...def, name: tableName };
    }
  }

  return { tables: result };
}
