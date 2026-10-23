// Public Podium GLSL retained as a visual fidelity reference.
export const fullscreenVertex = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const heroFragment = `
uniform bool uIsMobile;
uniform float uTime;
uniform float uShapeReveal;
uniform float uScrollProgress;
uniform float uPulseReveal;
uniform float uScrollZposition;
uniform sampler2D uBackgroundPodiumShapeTexture;
uniform vec2 uTextureShapeSize;
uniform sampler2D uMouseTexture;
uniform vec2 uResolution;
uniform vec3 uColorBeige;
uniform vec2 uMeshSize;
uniform float uScrollVelocity;
uniform float uFluidIntensity;
uniform float uNoiseIntensity;
uniform float uBarrelIntensity;
uniform float uUvScale;
uniform float uPulseMult;
varying vec2 vUv;


float hash(vec2 p) {
  return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x))));
}

float noise(vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}


vec2 barrelPincushion(vec2 uv, float strength) {
  vec2 st = uv - 0.5;
  float radius = 1.0 + strength * dot(st, st);
  return 0.5 + radius * st;
}


float sdCircle(in vec2 p, in float r) {
  return length(p) - r;
}

void main() {
  float FLUID_INTENSITY = uFluidIntensity;
  float NOISE_INTENSITY = uNoiseIntensity;
  float BARREL_PINCH_INTENSITY = uBarrelIntensity;

  /** Ratio */
  float textureShapeRatio = uTextureShapeSize.x / uTextureShapeSize.y;
  float meshRatio = uMeshSize.x / uMeshSize.y;
  float resolutionRatio = uResolution.x / uResolution.y;

  /** Pulse */
  float pulse = uPulseReveal * uPulseMult;

  /** UV */
  float uvScale = uUvScale - pulse;
  vec2 uv = (vUv - 0.5) * uvScale + 0.5;
  vec2 uvBarrel = barrelPincushion(uv, -uScrollZposition * BARREL_PINCH_INTENSITY);

  if (meshRatio > textureShapeRatio) {
    uvBarrel.x = (uvBarrel.x - 0.5) * (meshRatio / textureShapeRatio) + 0.5;
  } else {
    uvBarrel.y = (uvBarrel.y - 0.5) * (textureShapeRatio / meshRatio) + 0.5;
  }

  vec2 uvMouseTrail;
  vec3 mouseColor = vec3(0.0);

  if (uIsMobile) {
    uvMouseTrail = uvBarrel;
  } else {
    /** Noise */
    float fnoise = pow((1.0 - uScrollProgress), 4.0) * noise(uvBarrel * 1000.0) * NOISE_INTENSITY;

    /** Mouse Texture + Trail effect */
    mouseColor = texture2D(uMouseTexture, vUv).rgb * fnoise;
    uvMouseTrail = uvBarrel - vec2(mouseColor) * FLUID_INTENSITY;
  }

  vec2 podiumUv = uvMouseTrail;
  podiumUv.y = 1.0 - podiumUv.y;

  if (resolutionRatio < 1.0) {
    podiumUv.y += (1.0 - uScrollProgress) * (1.0 - resolutionRatio) * 0.3;
  }

  /** Texture Map */
  vec3 textureMap = texture2D(uBackgroundPodiumShapeTexture, podiumUv).rgb;

  /** Circle SDF */
  vec2 circleUv = vUv - 0.5;
  circleUv.x *= uMeshSize.x / uMeshSize.y;
  float sdf_circle = sdCircle(circleUv, 0.01);

  /** Texture shape SDF */
  float sdf_texture = 0.5 - textureMap.g;

  /** Blend SDFs */
  float sdf_final = mix(sdf_texture, sdf_circle, 1.0 - uShapeReveal);

  /** Attenuate trail near edges — blend off during circle phase */
  float edgeDist = abs(sdf_final);
  float edgeGuard = smoothstep(0.0, 0.05, edgeDist);
  float sdf_clean = mix(sdf_texture, sdf_final, edgeGuard);
  float sdf_guarded = mix(sdf_clean, sdf_final, edgeGuard);
  sdf_final = mix(sdf_final, sdf_guarded, uShapeReveal);

  /** Smooth mask */
  float mask = mix(
    smoothstep(0.001, 0.003, sdf_final),
    smoothstep(0.0, 0.003, sdf_final),
    pow(uShapeReveal, 4.0)
  );

  if (!uIsMobile) {
    float mask_scale_and_blur = length(circleUv) + smoothstep(-1.0, 1.0, sdf_final) + 0.3;
    mask = mix(mask, mask_scale_and_blur, uPulseReveal);
    mask = pow(mask, 4.0);
  }

  /** Output */
  vec3 color = vec3(uColorBeige);
  gl_FragColor = vec4(color, mask);
}
`;

export const mosaicFragment = `
uniform sampler2D uTexture;
uniform float uScrollVelocity;
uniform float uScroll;
uniform float uBarrelMultiplier;
uniform vec2 uPointerOffset;
uniform bool uIsMobile;
varying vec2 vUv;


vec2 barrelPincushion(vec2 uv, float strength) {
  vec2 st = uv - 0.5;
  float radius = 1.0 + strength * dot(st, st);
  return 0.5 + radius * st;
}


void main() {
  vec2 uv = clamp(vUv + uPointerOffset, vec2(0.0), vec2(1.0));
  vec2 uvBarrel = barrelPincushion(uv, uScrollVelocity * uBarrelMultiplier);

  vec4 textureColor = texture2D(uTexture, uvBarrel);

  if (uIsMobile) {
    gl_FragColor = vec4(textureColor.rgb, uScroll);
  } else {
    gl_FragColor = vec4(textureColor.rgb, textureColor.a * uScroll);
  }

  #include <colorspace_fragment>
}
`;

