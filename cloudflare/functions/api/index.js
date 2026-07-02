import { proxyApi } from "../_proxy.js";

export async function onRequest(context) {
  return proxyApi(context, "");
}
