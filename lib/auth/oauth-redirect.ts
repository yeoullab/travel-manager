const DEFAULT_AUTH_REDIRECT_PATH = "/trips";

export function sanitizeAuthRedirectPath(path: string | null | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return DEFAULT_AUTH_REDIRECT_PATH;
  }

  return path;
}

export function buildAuthCallbackUrl(origin: string, redirectPath: string | null | undefined): string {
  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("next", sanitizeAuthRedirectPath(redirectPath));
  return callbackUrl.toString();
}
