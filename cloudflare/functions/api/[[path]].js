import { proxyApi } from "../_proxy.js";

export async function onRequest(context) {
  const segments = context.params.path;
  const subpath = Array.isArray(segments)
    ? segments.join("/")
    : segments || "";
  return proxyApi(context, subpath);
}
