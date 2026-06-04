import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { connectFlexFromConfig } from "@flex/client/node";

export async function codegenCommand(cwd: string, moduleFilter?: string): Promise<void> {
  const { api, config } = connectFlexFromConfig({}, cwd);
  const functions = await api.listFunctions();

  const filtered = moduleFilter
    ? functions.filter((f) => f.path.startsWith(`${moduleFilter}:`))
    : functions;

  const lines: string[] = [
    "/** Автогенерация: flex codegen — не редактировать вручную */",
    `/** Сервер: ${config.url} */`,
    "import { connectFlexFromConfig, defineModuleApi } from \"@flex/client/node\";",
    "",
    "const { api } = connectFlexFromConfig();",
    "",
  ];

  const modules = new Map<string, typeof filtered>();
  for (const fn of filtered) {
    const [mod, name] = fn.path.split(":");
    if (!mod || !name) continue;
    if (!modules.has(mod)) modules.set(mod, []);
    modules.get(mod)!.push(fn);
  }

  for (const [mod, fns] of modules) {
    const safeMod = mod.replace(/[^a-zA-Z0-9_]/g, "_");
    lines.push(`export const ${safeMod} = {`);
    for (const fn of fns) {
      const [, name] = fn.path.split(":");
      const method = fn.kind === "query" ? "query" : "mutation";
      lines.push(
        `  /** ${fn.kind} */`,
        `  ${name}: (args: Record<string, unknown> = {}) =>`,
        `    api.${method}<unknown>("${fn.path}", args),`
      );
    }
    lines.push("};");
    lines.push("");
  }

  lines.push(
    "/** Хелпер для одного модуля */",
    "export function flexModule(name: string) {",
    "  return defineModuleApi(name, api);",
    "}",
    ""
  );

  const outDir = join(cwd, "src", "flex");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "api.generated.ts");
  writeFileSync(outPath, lines.join("\n"), "utf8");
  console.log(`Сгенерировано ${filtered.length} функций → ${outPath}`);
}
