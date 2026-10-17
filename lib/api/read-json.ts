import "server-only";
import { ApiError } from "./errors";

/** Bound memory even when Content-Length is missing or incorrect. */
export async function readJsonInput(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("request");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let text = "";
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 16_384) { await reader.cancel(); throw new ApiError("request"); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const data: unknown = JSON.parse(text);
    return data;
  } catch { throw new ApiError("request"); }
  finally { reader.releaseLock(); }
}
