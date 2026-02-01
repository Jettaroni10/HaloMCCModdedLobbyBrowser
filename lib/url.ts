export function getBaseUrl(request: Request) {
  const headers = request.headers;
  const forwardedProto = headers.get("x-forwarded-proto") ?? "";
  const forwardedHost = headers.get("x-forwarded-host") ?? "";

  let proto =
    forwardedProto.split(",")[0].trim() ||
    new URL(request.url).protocol.replace(":", "");
  const host =
    forwardedHost.split(",")[0].trim() ||
    headers.get("host") ||
    new URL(request.url).host;

  if (proto === "http" && host?.endsWith(":443")) {
    proto = "https";
  }
  if (!proto) {
    proto = "https";
  }

  return `${proto}://${host}`;
}

export function absoluteUrl(request: Request, path: string) {
  return new URL(path, getBaseUrl(request));
}
