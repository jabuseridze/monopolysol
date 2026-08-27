/**
 * Whether this browser can actually give us a WebGL context.
 *
 * Without this check a browser with WebGL disabled gets a full-page crash:
 * three.js throws "Error creating WebGL context" inside the `WebGLRenderer`
 * constructor, which happens during React's render pass, so it escapes as an
 * unhandled runtime error rather than anything the app can present nicely.
 *
 * This is not a rare edge case. Chrome silently falls back to no-WebGL when
 * hardware acceleration is switched off, when the GPU or driver is on its
 * blocklist, and -- most easily missed -- when too many live WebGL contexts
 * already exist across open tabs, since it caps them (~16) and simply refuses
 * to create the next one. The same machine can therefore work in one browser
 * and fail in another, or work and then stop working as tabs accumulate.
 *
 * The probe creates a throwaway context and immediately releases it via
 * `WEBGL_lose_context`; holding it open would itself consume one of the slots
 * the real canvas needs.
 */
export function webglAvailable(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ??
      canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    // Some builds throw rather than returning null when WebGL is disabled.
    return false;
  }
}
