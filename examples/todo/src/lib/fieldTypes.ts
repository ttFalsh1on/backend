export const FIELD_TYPES = ["string", "number", "boolean", "id"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export type FieldDef = { name: string; type: FieldType };

export function parseFieldsJson(json: string): FieldDef[] {
  try {
    const arr = JSON.parse(json) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (f): f is FieldDef =>
        typeof f === "object" &&
        f !== null &&
        typeof (f as FieldDef).name === "string" &&
        FIELD_TYPES.includes((f as FieldDef).type as FieldType)
    );
  } catch {
    return [];
  }
}

export function validateFields(fields: FieldDef[]): void {
  if (fields.length === 0) {
    throw new Error("Добавьте хотя бы одно поле");
  }
  const seen = new Set<string>();
  for (const f of fields) {
    const name = f.name.trim();
    if (!name) throw new Error("Имя поля не может быть пустым");
    if (!FIELD_TYPES.includes(f.type)) {
      throw new Error(`Недопустимый тип: ${f.type}`);
    }
    if (seen.has(name)) throw new Error(`Поле «${name}» уже есть`);
    seen.add(name);
  }
}

export function serializeFields(fields: FieldDef[]): string {
  return JSON.stringify(
    fields.map((f) => ({ name: f.name.trim(), type: f.type }))
  );
}
