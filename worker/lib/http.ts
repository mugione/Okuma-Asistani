import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { z } from "zod";

export class ApiError extends Error {
  constructor(
    public status: ContentfulStatusCode,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const ok = <T>(c: Context, data: T, status: ContentfulStatusCode = 200) => c.json({ success: true as const, data }, status);

export const fail = (c: Context, status: ContentfulStatusCode, code: string, message: string, details?: unknown) =>
  c.json({ success: false as const, error: { code, message, ...(details === undefined ? {} : { details }) } }, status);

export function parse<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "Gönderilen bilgiler geçersiz.",
      result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }
  return result.data;
}

export async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "İstek gövdesi geçerli bir JSON değil.");
  }
}

export const notFound = (what: string) => new ApiError(404, "NOT_FOUND", `${what} bulunamadı.`);
