"use client";

/**
 * Shown instead of the board when the browser cannot create a WebGL context.
 *
 * Deliberately actionable rather than apologetic: every cause of this is
 * fixable by the visitor in under a minute, but none of them are guessable
 * from "something went wrong". The alternative here is not a degraded board --
 * it is a full-page crash (see `webglSupport.ts`).
 */
export function NoWebGL() {
  return (
    <div className="nowebgl">
      <div className="panel nowebgl-card">
        <h1 className="nowebgl-title">This board needs 3D graphics</h1>
        <p className="nowebgl-lede">
          Your browser could not start WebGL, so the board cannot be drawn. The
          game itself is fine — this is a browser setting.
        </p>
        <ol className="nowebgl-steps">
          <li>
            Turn on <strong>hardware acceleration</strong>: Chrome → Settings →
            System → <em>Use graphics acceleration when available</em>, then
            restart Chrome.
          </li>
          <li>
            Close other 3D/WebGL tabs. Browsers cap how many can exist at once
            and refuse to create more.
          </li>
          <li>
            Check <code>chrome://gpu</code> — if <em>WebGL</em> reads
            &ldquo;Disabled&rdquo; or &ldquo;Software only&rdquo;, your GPU
            driver likely needs an update.
          </li>
        </ol>
        <p className="nowebgl-foot">Safari and Firefox are worth a try meanwhile.</p>
      </div>
    </div>
  );
}
