export function getAllowedOrigins(allowedOriginsEnv?: string): string[] {
  return (
    allowedOriginsEnv
      ?.split(",")
      .map((o) => o.trim())
      .filter(Boolean) ?? []
  );
}

export function getCORSOrigin(
  reqOrigin: string | undefined,
  allowedOrigins: string[],
  nodeEnv: string
): string {
  if (allowedOrigins.includes(reqOrigin || "")) {
    return reqOrigin!;
  }
  if (nodeEnv !== "production") {
    return reqOrigin || "*";
  }
  return "";
}
