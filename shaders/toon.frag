precision highp float;

varying vec3 vNormal;
varying vec3 vPosView;

uniform vec3 uColor;
uniform vec3 uAmbient;

uniform vec3 uDirLightDirection;
uniform vec3 uDirLightColor;

uniform vec3 uSpotPosition;
uniform vec3 uSpotDirection;
uniform vec3 uSpotColor;
uniform float uSpotIntensity;
uniform float uSpotCosCutoff;

// three.js supplies uniform mat4 viewMatrix;

void main() {
  vec3 N = normalize(vNormal);

  // Directional light toon steps
  vec3 Ld = normalize((viewMatrix * vec4(-uDirLightDirection, 0.0)).xyz);
  float diffD = max(dot(N, Ld), 0.0);
  float levels = 3.0;
  float toonDiffD = floor(diffD * levels) / (levels - 0.5);

  // Spotlight toon steps
  vec3 spotPosV = (viewMatrix * vec4(uSpotPosition, 1.0)).xyz;
  vec3 spotDirV = normalize((viewMatrix * vec4(uSpotDirection, 0.0)).xyz);
  vec3 Ls = normalize(vPosView - spotPosV);
  float cosTheta = dot(spotDirV, Ls);
  float spotMask = smoothstep(uSpotCosCutoff, uSpotCosCutoff + 0.05, cosTheta);
  float diffS = max(dot(N, -Ls), 0.0) * spotMask;
  float toonDiffS = floor(diffS * levels) / (levels - 0.5);

  vec3 color = uAmbient;
  color += uColor * uDirLightColor * toonDiffD;
  color += uSpotColor * toonDiffS * uSpotIntensity;

  gl_FragColor = vec4(color, 1.0);
}

