/**
 * CSRF and Origin verification helpers for state-changing API routes.
 */

export function verifyOrigin(request: Request): { valid: boolean; error?: string } {
  const method = request.method.toUpperCase();

  // Safe HTTP methods do not require origin verification
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return { valid: true };
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const forwardedHost = request.headers.get("x-forwarded-host");

  const matchesHost = (testHost: string) => {
    return (host && testHost === host) || (forwardedHost && testHost === forwardedHost);
  };

  if (!origin) {
    // If origin is missing, check referer header
    const referer = request.headers.get("referer");
    if (!referer) {
      if (host || forwardedHost) {
        return { valid: true };
      }
      return { valid: false, error: "Missing Origin and Referer headers on state-changing request" };
    }

    try {
      const refererUrl = new URL(referer);
      if (!matchesHost(refererUrl.host)) {
        return { valid: false, error: "Referer origin mismatch" };
      }
      return { valid: true };
    } catch {
      return { valid: false, error: "Invalid Referer header" };
    }
  }

  try {
    const originUrl = new URL(origin);
    if (!matchesHost(originUrl.host)) {
      return { valid: false, error: "Cross-site request forgery protection: Origin mismatch" };
    }
  } catch {
    return { valid: false, error: "Invalid Origin header format" };
  }

  return { valid: true };
}
