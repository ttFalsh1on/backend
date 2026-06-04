import { z } from "zod";
import type { Validator } from "./types.js";

class BaseValidator implements Validator {
  readonly _type: string;
  readonly _table?: string;

  constructor(type: string, table?: string) {
    this._type = type;
    this._table = table;
  }

  parse(value: unknown): unknown {
    return value;
  }

  optional(): Validator {
    return new OptionalValidator(this);
  }
}

class OptionalValidator extends BaseValidator {
  private inner: Validator;

  constructor(inner: Validator) {
    super("optional");
    this.inner = inner;
  }

  override parse(value: unknown): unknown {
    if (value === undefined) return undefined;
    return this.inner.parse(value);
  }
}

class ZodBackedValidator extends BaseValidator {
  private schema: z.ZodType;

  constructor(type: string, schema: z.ZodType, table?: string) {
    super(type, table);
    this.schema = schema;
  }

  override parse(value: unknown): unknown {
    return this.schema.parse(value);
  }
}

function zodValidator(type: string, schema: z.ZodType): Validator {
  return new ZodBackedValidator(type, schema);
}

export const v = {
  string: () => zodValidator("string", z.string()),
  number: () => zodValidator("number", z.number()),
  boolean: () => zodValidator("boolean", z.boolean()),
  null: () => zodValidator("null", z.null()),
  any: () => zodValidator("any", z.unknown()),

  id: (table: string) =>
    new ZodBackedValidator("id", z.string().min(1), table),

  array: (item: Validator) =>
    zodValidator("array", z.array(z.unknown()).transform((arr) => arr.map((x) => item.parse(x)))),

  object: <T extends Record<string, Validator>>(shape: T) => {
    const keys = Object.keys(shape);
    const schema = z
      .object(
        Object.fromEntries(
          keys.map((k) => [k, z.unknown()])
        ) as Record<string, z.ZodType>
      )
      .transform((obj) => {
        const result: Record<string, unknown> = {};
        for (const key of keys) {
          result[key] = shape[key].parse(obj[key]);
        }
        return result;
      });
    return zodValidator("object", schema);
  },

  optional: (inner: Validator) => inner.optional(),

  union: (...validators: Validator[]) =>
    zodValidator("union", z.unknown().transform((val) => {
      for (const validator of validators) {
        try {
          return validator.parse(val);
        } catch {
          /* try next */
        }
      }
      throw new Error("Value did not match any union member");
    })),
};

export function parseArgs(
  validator: Validator,
  args: Record<string, unknown>
): Record<string, unknown> {
  return validator.parse(args) as Record<string, unknown>;
}
