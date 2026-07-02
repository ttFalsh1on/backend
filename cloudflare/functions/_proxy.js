const DEFAULT_ORIGIN =
  "https://flex-backend-ttfalsh1ons-projects.vercel.app";

export async function proxyApi(context, subpath) {
  const origin = context.env?.VERCEL_ORIGIN || DEFAULT_ORIGIN;
  const incoming = new URL(context.request.url);
  const path = subpath ? `/api/${subpath}` : "/api";
  const target = new URL(`${path}${incoming.search}`, origin);

  const headers = new Headers(context.request.headers);
  headers.delete("host");
  headers.set("Host", new URL(origin).host);

  const init = {
    method: context.request.method,
    headers,
    redirect: "manual",
  };
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    init.body = context.request.body;
  }

  const response = await fetch(target.toString(), init);
  const outHeaders = new Headers(response.headers);
  outHeaders.set("Access-Control-Allow-Origin", "*");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: outHeaders,
  });
}
