/*
 * Faithful port of the Antigravity site's particle component
 * (antigravity.google, `MainParticlesComponent`, three.js r180).
 *
 * The official effect is a GPU simulation, not a CPU orbit:
 *
 *   1. ~20k points are poisson-disc sampled into a 500×500 space and stored in
 *      a 256×256 RGBA float texture (RG = reference position / 250, B = scale,
 *      A = velocity). The remaining texels stay zero (alpha-discard hides them).
 *   2. Every other frame a sim shader renders that texture into a ping-pong
 *      render target: points near a *breathing* ring (`0.175 + sin(t)*0.03 +
 *      cos(3t)*0.02`) accumulate scale/velocity and are displaced toward the
 *      ring with perlin turbulence; everything else relaxes around its home.
 *   3. A point-cloud render shader draws each texel as a small rotated capsule
 *      sprite, sized/brightened by its sim scale & velocity, noise-mixing
 *      color1/color2/color3 — producing the glowing galaxy blob ("tide") that
 *      eases after the cursor (lerp 0.02) or wanders on noise when idle.
 *
 * All constants are the site's dark-scheme values: density 220, particles-scale
 * 0.65, ring-width 0.15, ring-width2 0.05, ring-displacement 0.23, colors
 * #7189ff / #3074f9 / #000000.
 *
 * Adapted for Lorelum: TypeScript, @react-three/fiber mount, SSR-safe (the
 * callers gate this via `motion-aware-*`), DPR capped at 1, sim paused when the
 * canvas leaves the viewport, and full disposal on unmount.
 */

/* eslint-disable react/no-unknown-property */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { poissonDiscFill } from '@/lib/poisson-disc';

export interface AntigravityProps {
  /** Poisson density (the site's `data-density`). Higher = fewer, denser points. */
  density?: number;
  /** Point size multiplier (the site's `data-particles-scale`). */
  particlesScale?: number;
  /** Outer ring band width (the site's `data-ring-width`). */
  ringWidth?: number;
  /** Tight inner band width (the site's `data-ring-width2`). */
  ringWidth2?: number;
  /** Displacement strength onto the ring (the site's `data-ring-displacement`). */
  ringDisplacement?: number;
}

const SIM_SIZE = 256;
const SAMPLE_SPACE = 500;

/* Ashima 3D simplex noise — the same `snoise` the site's shaders include. */
const SNOISE = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

/*
 * Sim pass (site's `simMaterial`): integrates every particle state texel.
 * Input:  uPosition  = previous frame state (or the initial ref texture)
 *         uPosRefs   = static reference positions
 * Output: new state = vec4(finalPos, scale, velocity)
 */
const SIM_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uPosition;
uniform sampler2D uPosRefs;
uniform vec2 uRingPos;
uniform float uTime;
uniform float uDeltaTime;
uniform float uRingRadius;
uniform float uRingWidth;
uniform float uRingWidth2;
uniform float uRingDisplacement;
${SNOISE}
void main() {
  vec2 simTexCoords = gl_FragCoord.xy / vec2(${SIM_SIZE.toFixed(1)}, ${SIM_SIZE.toFixed(1)});
  vec4 pFrame = texture2D(uPosition, simTexCoords);
  float scale = pFrame.z;
  float velocity = pFrame.w;
  vec2 refPos = texture2D(uPosRefs, simTexCoords).xy;

  float time = uTime * .5;
  vec2 curentPos = refPos;

  vec2 pos = pFrame.xy;
  pos *= .8;

  float dist = distance(curentPos.xy, uRingPos);
  float noise0 = snoise(vec3(curentPos.xy * .2 + vec2(18.4924, 72.9744), time * 0.5));
  float dist1 = distance(curentPos.xy + (noise0 * .005), uRingPos);

  float t = smoothstep(uRingRadius - (uRingWidth * 2.), uRingRadius, dist) - smoothstep(uRingRadius, uRingRadius + uRingWidth, dist1);
  float t2 = smoothstep(uRingRadius - (uRingWidth2 * 2.), uRingRadius, dist) - smoothstep(uRingRadius, uRingRadius + uRingWidth2, dist1);
  float t3 = smoothstep(uRingRadius + uRingWidth2, uRingRadius, dist);

  t = pow(t, 2.);
  t2 = pow(t2, 3.);

  t += t2 * 3.;
  t += t3 * .4;
  t += snoise(vec3(curentPos.xy * 30. + vec2(11.4924, 12.9744), time * 0.5)) * t3 * .5;

  float nS = snoise(vec3(curentPos.xy * 2. + vec2(18.4924, 72.9744), time * 0.5));
  t += pow((nS + 1.5) * .5, 2.) * .6;

  // Mid scale noise
  float noise1 = snoise(vec3(curentPos.xy * 4. + vec2(88.494, 32.4397), time * 0.35));
  float noise2 = snoise(vec3(curentPos.xy * 4. + vec2(50.904, 120.947), time * 0.35));

  // Close scale noise
  float noise3 = snoise(vec3(curentPos.xy * 20. + vec2(18.4924, 72.9744), time * .5));
  float noise4 = snoise(vec3(curentPos.xy * 20. + vec2(50.904, 120.947), time * .5));

  vec2 disp = vec2(noise1, noise2) * .03;
  disp += vec2(noise3, noise4) * .005;

  // Sin wave
  disp.x += sin((refPos.x * 20.) + (time * 4.)) * .02 * clamp(dist, 0., 1.);
  disp.y += cos((refPos.y * 20.) + (time * 3.)) * .02 * clamp(dist, 0., 1.);

  pos -= (uRingPos - (curentPos + disp)) * pow(t2, .75) * uRingDisplacement;

  // Add scale
  float scaleDiff = t - scale;
  scaleDiff *= .2;
  scale += scaleDiff;

  // Final position
  vec2 finalPos = curentPos + disp + (pos * .25);

  velocity *= .5;
  velocity += scale * .25;

  gl_FragColor = vec4(finalPos, scale, velocity);
}
`;

const SIM_VERT = /* glsl */ `
void main() {
  gl_Position = vec4(position, 1.0);
}
`;

/*
 * Render pass (site's `renderMaterial`): draws one point per state texel as a
 * rotated capsule sprite, sized by sim scale, coloured by noise-mixed palette,
 * dark scheme multiplies colour by velocity (bright blob, dim dust).
 */
const RENDER_VERT = /* glsl */ `
precision highp float;
attribute vec4 seeds;
uniform sampler2D uPosition;
uniform float uTime;
uniform float uParticleScale;
uniform float uPixelRatio;
varying vec4 vSeeds;
varying float vVelocity;
varying vec2 vLocalPos;
varying vec2 vScreenPos;
varying float vScale;
void main() {
  vec4 pos = texture2D(uPosition, uv);
  vSeeds = seeds;
  vVelocity = pos.w;
  vScale = pos.z;
  vLocalPos = pos.xy;
  vec4 viewSpace = modelViewMatrix * vec4(vec3(pos.xy, 0.), 1.0);
  gl_Position = projectionMatrix * viewSpace;
  vScreenPos = gl_Position.xy;
  gl_PointSize = ((vScale * 7.) * (uPixelRatio * 0.5) * uParticleScale);
}
`;

const RENDER_FRAG = /* glsl */ `
precision highp float;
varying vec4 vSeeds;
varying vec2 vScreenPos;
varying vec2 vLocalPos;
varying float vScale;
varying float vVelocity;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uRingPos;
uniform vec2 uRez;
uniform float uAlpha;
uniform float uTime;
uniform int uColorScheme;
${SNOISE}
float sdRoundBox(in vec2 p, in vec2 b, in vec4 r) {
  r.xy = (p.x > 0.0) ? r.xy : r.zw;
  r.x = (p.y > 0.0) ? r.x : r.y;
  vec2 q = abs(p) - b + r.x;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r.x;
}
vec2 rotate(vec2 v, float a) {
  float s = sin(a);
  float c = cos(a);
  mat2 m = mat2(c, s, -s, c);
  return m * v;
}
void main() {
  float uBorderSize = 0.2;
  float ratio = uRez.x / uRez.y;

  float noiseAngle = snoise(vec3(vLocalPos * 10. + vec2(18.4924, 72.9744), uTime * .85));
  float noiseColor = snoise(vec3(vLocalPos * 2. + vec2(74.664, 91.556), uTime * .5));
  noiseColor = (noiseColor + 1.) * .5;

  float angle = atan(vLocalPos.y - uRingPos.y, vLocalPos.x - uRingPos.x);

  vec2 uv = gl_PointCoord.xy;
  uv -= vec2(0.5);
  uv.y *= -1.;
  uv = rotate(uv, -angle + (noiseAngle * .5));

  vec2 tuv = vScreenPos;
  tuv = rotate(tuv, uTime * 1.);
  tuv.y *= 1. / ratio;
  tuv += .5;

  float h = 0.8;
  float progress = smoothstep(0., .75, pow(noiseColor, 2.));
  vec3 col = mix(mix(uColor1, uColor2, progress / h), mix(uColor2, uColor3, (progress - h) / (1.0 - h)), step(h, progress));
  vec3 color = col;

  float dist = sqrt(dot(uv, uv));
  float dr = .5;
  float t = smoothstep(dr + (uBorderSize + .0001), dr - uBorderSize, dist);
  t = clamp(t, 0., 1.);

  float rounded = sdRoundBox(uv, vec2(0.5, 0.2), vec4(.25));
  rounded = smoothstep(.1, 0., rounded);

  float a = uAlpha * rounded * smoothstep(0.1, 0.2, vScale);
  if (a < 0.01) {
    discard;
  }

  color = clamp(color, 0., 1.);
  color = mix(color, color * clamp(vVelocity, 0., 1.), float(uColorScheme));

  gl_FragColor = vec4(color, clamp(a, 0., 1.));
}
`;

/* Smooth 1D pseudo-noise in [-1, 1] — stands in for the site's simplex wander. */
function noise1D(x: number): number {
  return (
    (Math.sin(x) + Math.sin(x * 2.17 + 1.7) * 0.6 + Math.sin(x * 4.31 + 3.1) * 0.35) / 1.95
  );
}

const AntigravityInner = ({
  density = 220,
  particlesScale = 0.65,
  ringWidth = 0.15,
  ringWidth2 = 0.05,
  ringDisplacement = 0.23,
}: AntigravityProps) => {
  const { gl, size, viewport } = useThree();

  const visibleRef = useRef(true);
  useEffect(() => {
    // Pause sim/render while the canvas is off-screen (the site does the same
    // via IntersectionObserver), without stopping fiber's frameloop — a
    // stopped frameloop skips resizes and froze the buffer at 300x150.
    const canvas = gl.domElement;
    const io = new IntersectionObserver(
      entries => entries.forEach(entry => (visibleRef.current = entry.isIntersecting)),
      { threshold: 0 }
    );
    io.observe(canvas);
    return () => io.disconnect();
  }, [gl]);

  const ringPosRef = useRef(new THREE.Vector2(0, 0));
  const cursorRef = useRef(new THREE.Vector2(0, 0));
  const lastMoveRef = useRef(0);
  const pointerNormRef = useRef({ x: -2, y: -2, over: false });
  const frameRef = useRef(0);
  const pingPongRef = useRef<{ read: THREE.WebGLRenderTarget; write: THREE.WebGLRenderTarget } | null>(null);
  const everRenderedRef = useRef(false);
  const particleScaleRef = useRef(0.4);

  /*
   * One-time GPU resources: initial state texture, ping-pong targets, the sim
   * quad scene, and the points geometry/material.
   */
  const gpu = useMemo(() => {
    // density -> poisson spacing, exactly the site's lerp mapping.
    const lerpDensity = (a: number, b: number) => (density * (b - a)) / 300 + a;
    const minDistance = lerpDensity(10, 2);
    const maxDistance = lerpDensity(11, 3);

    const samples = poissonDiscFill({
      shape: [SAMPLE_SPACE, SAMPLE_SPACE],
      minDistance,
      maxDistance,
      tries: 20,
    });
    const count = samples.length;

    // Initial state texture: RG = ref position / 250, B = scale, A = velocity.
    const stateData = new Float32Array(SIM_SIZE * SIM_SIZE * 4);
    for (let i = 0; i < count; i++) {
      const [sx, sy] = samples[i]!;
      stateData[i * 4 + 0] = (sx - SAMPLE_SPACE / 2) * (1 / (SAMPLE_SPACE / 2));
      stateData[i * 4 + 1] = (sy - SAMPLE_SPACE / 2) * (1 / (SAMPLE_SPACE / 2));
      stateData[i * 4 + 2] = 0;
      stateData[i * 4 + 3] = 0;
    }
    const posTex = new THREE.DataTexture(stateData, SIM_SIZE, SIM_SIZE, THREE.RGBAFormat, THREE.FloatType);
    posTex.minFilter = THREE.NearestFilter;
    posTex.magFilter = THREE.NearestFilter;
    posTex.needsUpdate = true;

    const rtOptions: THREE.RenderTargetOptions = {
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false,
    };
    const rt1 = new THREE.WebGLRenderTarget(SIM_SIZE, SIM_SIZE, rtOptions);
    const rt2 = new THREE.WebGLRenderTarget(SIM_SIZE, SIM_SIZE, rtOptions);
    pingPongRef.current = { read: rt1, write: rt2 };

    // Sim quad scene (full-screen triangle pair, orthographic).
    const simMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uPosition: { value: posTex },
        uPosRefs: { value: posTex },
        uRingPos: { value: new THREE.Vector2(0, 0) },
        uRingRadius: { value: 0.2 },
        uDeltaTime: { value: 0 },
        uRingWidth: { value: ringWidth },
        uRingWidth2: { value: ringWidth2 },
        uRingDisplacement: { value: ringDisplacement },
        uTime: { value: 0 },
      },
      vertexShader: SIM_VERT,
      fragmentShader: SIM_FRAG,
      depthTest: false,
      depthWrite: false,
    });
    const simScene = new THREE.Scene();
    const simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const simQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMaterial);
    simScene.add(simQuad);

    // Points geometry: one vertex per sample, position texel grid in `uv`.
    const geometry = new THREE.BufferGeometry();
    const uv = new Float32Array(count * 2);
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      uv[i * 2] = (i % SIM_SIZE) / SIM_SIZE;
      uv[i * 2 + 1] = Math.floor(i / SIM_SIZE) / SIM_SIZE;
      seeds[i * 4] = Math.random();
      seeds[i * 4 + 1] = Math.random();
      seeds[i * 4 + 2] = Math.random();
      seeds[i * 4 + 3] = Math.random();
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geometry.setAttribute('seeds', new THREE.BufferAttribute(seeds, 4));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10);

    const renderMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uPosition: { value: posTex },
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color('#7189ff') },
        uColor2: { value: new THREE.Color('#3074f9') },
        uColor3: { value: new THREE.Color('#000000') },
        uAlpha: { value: 1 },
        uRingPos: { value: new THREE.Vector2(0, 0) },
        uRez: { value: new THREE.Vector2(1, 1) },
        uParticleScale: { value: 0.4 },
        uPixelRatio: { value: 1 },
        uColorScheme: { value: 1 },
      },
      vertexShader: RENDER_VERT,
      fragmentShader: RENDER_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });

    return { posTex, rt1, rt2, simScene, simCamera, simQuad, simMaterial, geometry, renderMaterial, count };
    // Recreate only if density changes (re-sampling is expensive).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [density]);

  useEffect(() => {
    const gpuRef = gpu;
    return () => {
      gpuRef.geometry.dispose();
      gpuRef.renderMaterial.dispose();
      gpuRef.simMaterial.dispose();
      (gpuRef.simQuad as THREE.Mesh).geometry.dispose();
      gpuRef.posTex.dispose();
      gpuRef.rt1.dispose();
      gpuRef.rt2.dispose();
    };
  }, [gpu]);

  // Pointer tracking over the whole window (the layer is pointer-events-none).
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      lastMoveRef.current = performance.now();
      pointerNormRef.current.over = true;
      pointerNormRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointerNormRef.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  useFrame(state => {
    if (!visibleRef.current) return; // off-screen: hold the last frame
    const t = state.clock.getElapsedTime();
    const dt = state.clock.getDelta();
    frameRef.current += 1;

    const { simMaterial, renderMaterial } = gpu;
    const width = size.width || 1;
    const height = size.height || 1;

    // The site's per-frame particle scale: canvasWidth / pixelRatio / 2000 * scale.
    particleScaleRef.current = (width / 1 / 2000) * particlesScale;

    /*
     * Cursor position: the site raycasts a plane and maps the hit through
     * 0.175, plus simplex wander; idle (no recent pointer) is wander-only.
     * The plane half-extent maps to the fiber viewport at z=0.
     */
    const halfW = viewport.width / 2;
    const halfH = viewport.height / 2;
    const nowMs = performance.now();
    const idle = nowMs - lastMoveRef.current > 1400;
    const wanderT = t * 0.66 + 94.234;
    const wanderN = t * 0.75 + 21.028;
    if (!idle && pointerNormRef.current.over) {
      cursorRef.current.set(
        pointerNormRef.current.x * halfW * 0.175 + noise1D(wanderT) * 0.1,
        pointerNormRef.current.y * halfH * 0.175 + noise1D(wanderN) * 0.1
      );
      ringPosRef.current.x += (cursorRef.current.x - ringPosRef.current.x) * 0.02;
      ringPosRef.current.y += (cursorRef.current.y - ringPosRef.current.y) * 0.02;
    } else {
      cursorRef.current.set(noise1D(wanderT) * 0.2, noise1D(wanderN) * 0.1);
      ringPosRef.current.x += (cursorRef.current.x - ringPosRef.current.x) * 0.01;
      ringPosRef.current.y += (cursorRef.current.y - ringPosRef.current.y) * 0.01;
    }

    const ringRadius = 0.175 + Math.sin(t) * 0.03 + Math.cos(t * 3) * 0.02;

    simMaterial.uniforms.uPosition.value = everRenderedRef.current ? pingPongRef.current!.read.texture : gpu.posTex;
    simMaterial.uniforms.uTime.value = t;
    simMaterial.uniforms.uDeltaTime.value = dt;
    simMaterial.uniforms.uRingRadius.value = ringRadius;
    (simMaterial.uniforms.uRingPos.value as THREE.Vector2).copy(ringPosRef.current);

    renderMaterial.uniforms.uTime.value = t;
    (renderMaterial.uniforms.uRingPos.value as THREE.Vector2).copy(ringPosRef.current);
    renderMaterial.uniforms.uParticleScale.value = particleScaleRef.current;
    (renderMaterial.uniforms.uRez.value as THREE.Vector2).set(width, height);

    // Sim every other frame (the site's skipFrame), then render to the write RT.
    if (frameRef.current % 2 === 0) {
      gl.setRenderTarget(pingPongRef.current!.write);
      gl.render(gpu.simScene, gpu.simCamera);
      gl.setRenderTarget(null);
      renderMaterial.uniforms.uPosition.value = everRenderedRef.current
        ? pingPongRef.current!.write.texture
        : gpu.posTex;
      // Swap for the next sim step.
      pingPongRef.current = { read: pingPongRef.current!.write, write: pingPongRef.current!.read };
      everRenderedRef.current = true;
    } else if (everRenderedRef.current) {
      renderMaterial.uniforms.uPosition.value = pingPongRef.current!.read.texture;
    } else {
      renderMaterial.uniforms.uPosition.value = gpu.posTex;
    }
  });

  return (
    <points geometry={gpu.geometry} frustumCulled={false} scale={5}>
      <primitive object={gpu.renderMaterial} attach="material" />
    </points>
  );
};

const Antigravity = (props: AntigravityProps) => {
  return (
    <Canvas
      camera={{ position: [0, 0, 3.1], fov: 40 }}
      dpr={1}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', stencil: false }}
      style={{ width: '100%', height: '100%' }}
    >
      <AntigravityInner {...props} />
    </Canvas>
  );
};

export default Antigravity;
