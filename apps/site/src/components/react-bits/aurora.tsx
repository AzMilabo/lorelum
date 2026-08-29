/*
 * Vendored from React Bits (https://reactbits.dev) — Aurora (TypeScript + Tailwind variant).
 * Source: https://reactbits.dev/r/Aurora-TS-TW
 * License: MIT + Commons Clause (see https://reactbits.dev/LICENSE.md).
 * Adapted for Lorelum's performance budget:
 *   - `paused` prop stops the rAF loop (tab hidden / hero offscreen).
 *   - DPR is capped at 1.25 and the backing canvas at 1600x1000 so the
 *     fill-rate stays bounded on retina/4K displays.
 *   - All props are read through a ref so the renderer never re-initializes
 *     on prop changes.
 * See apps/site/THIRD_PARTY_NOTICE.md.
 */
import { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Color, Triangle } from 'ogl';

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;
uniform float uLightMode;

out vec4 fragColor;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v){
  const vec4 C = vec4(
      0.211324865405187, 0.366025403784439,
      -0.577350269189626, 0.024390243902439
  );
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);

  vec3 p = permute(
      permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0)
  );

  vec3 m = max(
      0.5 - vec3(
          dot(x0, x0),
          dot(x12.xy, x12.xy),
          dot(x12.zw, x12.zw)
      ),
      0.0
  );
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);

  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

struct ColorStop {
  vec3 color;
  float position;
};

#define COLOR_RAMP(colors, factor, finalColor) {              \
  int index = 0;                                            \
  for (int i = 0; i < 2; i++) {                               \
     ColorStop currentColor = colors[i];                    \
     bool isInBetween = currentColor.position <= factor;    \
     index = int(mix(float(index), float(i), float(isInBetween))); \
  }                                                         \
  ColorStop currentColor = colors[index];                   \
  ColorStop nextColor = colors[index + 1];                  \
  float range = nextColor.position - currentColor.position; \
  float lerpFactor = (factor - currentColor.position) / range; \
  finalColor = mix(currentColor.color, nextColor.color, lerpFactor); \
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  ColorStop colors[3];
  colors[0] = ColorStop(uColorStops[0], 0.0);
  colors[1] = ColorStop(uColorStops[1], 0.5);
  colors[2] = ColorStop(uColorStops[2], 1.0);

  vec3 rampColor;
  COLOR_RAMP(colors, uv.x, rampColor);

  float height = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;
  height = exp(height);
  height = (uv.y * 2.0 - height + 0.2);
  float intensity = 0.6 * height;

  float midPoint = 0.20;
  float auroraAlpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);

  vec3 auroraColor = intensity * rampColor;

  if (uLightMode > 0.5) {
    float energy = clamp(max(intensity, 0.0), 0.0, 1.0);
    float coverage = clamp(auroraAlpha * (0.55 + 0.45 * energy), 0.0, 0.86);
    vec3 chroma = pow(clamp(rampColor, 0.0, 1.0), vec3(1.2));
    float chromaPeak = max(chroma.r, max(chroma.g, chroma.b));
    chroma /= max(chromaPeak, 0.0001);
    fragColor = vec4(mix(vec3(1.0), chroma, min(coverage * 1.08, 0.94)), 1.0);
  } else {
    fragColor = vec4(auroraColor * auroraAlpha, auroraAlpha);
  }
}
`;

interface AuroraProps {
  colorStops?: string[];
  amplitude?: number;
  blend?: number;
  speed?: number;
  lightMode?: boolean;
  /** When true the rAF loop stops (tab hidden / hero scrolled away). */
  paused?: boolean;
}

/** Cap so we never rasterize above ~2 MP on high-DPI displays. */
const MAX_DPR = 1.25;
const MAX_WIDTH = 1600;
const MAX_HEIGHT = 1000;

export default function Aurora(props: AuroraProps) {
  const {
    colorStops = ['#6366f1', '#a855f7', '#22d3ee'],
    amplitude = 1.0,
    blend = 0.6,
    lightMode = false,
  } = props;
  const propsRef = useRef<AuroraProps>(props);
  propsRef.current = props;

  const ctnDom = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<{ start: () => void; stop: () => void } | null>(null);

  useEffect(() => {
    const ctn = ctnDom.current;
    if (!ctn) return;

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const renderer = new Renderer({
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
      dpr,
    });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.canvas.style.backgroundColor = 'transparent';

    let program: Program | undefined;

    function resize() {
      if (!ctn) return;
      const width = Math.min(ctn.offsetWidth, MAX_WIDTH);
      const height = Math.min(ctn.offsetHeight, MAX_HEIGHT);
      renderer.setSize(width, height);
      if (program) {
        program.uniforms.uResolution.value = [gl.canvas.width, gl.canvas.height];
      }
    }
    window.addEventListener('resize', resize);

    const geometry = new Triangle(gl);
    if (geometry.attributes.uv) {
      delete geometry.attributes.uv;
    }

    const stops = colorStops.map((hex) => {
      const c = new Color(hex);
      return [c.r, c.g, c.b];
    });

    program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uAmplitude: { value: amplitude },
        uColorStops: { value: stops },
        uResolution: { value: [ctn.offsetWidth, ctn.offsetHeight] },
        uBlend: { value: blend },
        uLightMode: { value: lightMode ? 1 : 0 },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });
    ctn.appendChild(gl.canvas);

    let animateId = 0;
    let running = true;

    const update = (t: number) => {
      if (!running) return;
      animateId = requestAnimationFrame(update);
      const p = propsRef.current;
      const time = t * 0.01;
      const s = p.speed ?? 1.0;
      if (program) {
        program.uniforms.uTime.value = time * s * 0.1;
        program.uniforms.uAmplitude.value = p.amplitude ?? amplitude;
        program.uniforms.uBlend.value = p.blend ?? blend;
        program.uniforms.uLightMode.value = (p.lightMode ?? lightMode) ? 1 : 0;
        const curStops = p.colorStops ?? colorStops;
        program.uniforms.uColorStops.value = curStops.map((hex: string) => {
          const c = new Color(hex);
          return [c.r, c.g, c.b];
        });
        renderer.render({ scene: mesh });
      }
    };

    const start = () => {
      if (running) return;
      running = true;
      animateId = requestAnimationFrame(update);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(animateId);
    };

    controlsRef.current = { start, stop };
    animateId = requestAnimationFrame(update);
    resize();

    return () => {
      running = false;
      cancelAnimationFrame(animateId);
      controlsRef.current = null;
      window.removeEventListener('resize', resize);
      if (ctn && gl.canvas.parentNode === ctn) {
        ctn.removeChild(gl.canvas);
      }
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [amplitude, blend, colorStops, lightMode]);

  // Pause/resume from the host (tab hidden, hero scrolled away, reduced motion).
  useEffect(() => {
    if (props.paused) {
      controlsRef.current?.stop();
    } else {
      controlsRef.current?.start();
    }
  }, [props.paused]);

  return <div ref={ctnDom} className="pointer-events-none h-full w-full" />;
}


