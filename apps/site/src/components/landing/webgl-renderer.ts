/**
 * Client-only WebGL renderer probe for the landing page.
 *
 * Reads the *unmasked* GL_RENDERER string (the actual driver behind the
 * browser), which reveals software rasterizers that the default RENDERER
 * query hides. Requires `WEBGL_debug_renderer_info`; when it is absent we
 * conservatively assume hardware (the extension is present in every
 * Chromium/Edge/Firefox build, so a missing extension already implies an
 * unusual embedder — assume the best rather than degrade a working setup).
 *
 * Browser-only: guards on `typeof window`. Cheap and synchronous, safe to
 * call once during mount (the probe canvas is immediately discarded).
 */

import { isSoftwareRenderer } from './gates/webgl-capability';

export type WebglCapability = 'hardware' | 'software' | 'unknown';

export function detectWebglRenderer(): WebglCapability {
  if (typeof window === 'undefined') return 'unknown';
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') ??
      canvas.getContext('webgl2')) as WebGLRenderingContext | null;
    if (!gl) return 'unknown';

    const ext = gl.getExtension('WEBGL_debug_renderer_info') as
      | { UNMASKED_RENDERER_WEBGL: number }
      | null;
    const name = ext
      ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return isSoftwareRenderer(name) ? 'software' : 'hardware';
  } catch {
    return 'unknown';
  }
}
