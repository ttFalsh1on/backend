import type {
  FunctionContext,
  FunctionHandler,
  FunctionKind,
  RegisteredFunction,
  Validator,
} from "./types.js";
import { v } from "./validators.js";

export interface FunctionDef<TArgs extends Record<string, Validator>> {
  args: TArgs;
  handler: (
    ctx: FunctionContext,
    args: { [K in keyof TArgs]: unknown }
  ) => Promise<unknown>;
}

function buildArgsValidator<T extends Record<string, Validator>>(
  args: T
): Validator {
  if (Object.keys(args).length === 0) {
    return v.object({});
  }
  return v.object(args);
}

function defineFunction<K extends FunctionKind, T extends Record<string, Validator>>(
  kind: K,
  def: FunctionDef<T>
): RegisteredFunction {
  return {
    path: "",
    kind,
    argsValidator: buildArgsValidator(def.args),
    handler: def.handler as FunctionHandler,
  };
}

export function query<T extends Record<string, Validator>>(
  def: FunctionDef<T>
): RegisteredFunction {
  return defineFunction("query", def);
}

export function mutation<T extends Record<string, Validator>>(
  def: FunctionDef<T>
): RegisteredFunction {
  return defineFunction("mutation", def);
}

export function action<T extends Record<string, Validator>>(
  def: FunctionDef<T>
): RegisteredFunction {
  return defineFunction("action", def);
}

export function internalQuery<T extends Record<string, Validator>>(
  def: FunctionDef<T>
): RegisteredFunction {
  const fn = defineFunction("query", def);
  (fn as RegisteredFunction & { internal: boolean }).internal = true;
  return fn;
}

export function internalMutation<T extends Record<string, Validator>>(
  def: FunctionDef<T>
): RegisteredFunction {
  const fn = defineFunction("mutation", def);
  (fn as RegisteredFunction & { internal: boolean }).internal = true;
  return fn;
}
