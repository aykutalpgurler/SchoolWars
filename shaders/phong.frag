precision highp float;

varying vec3 vNormal;
varying vec3 vPosView;

uniform vec3 uColor;
uniform vec3 uAmbient;

uniform vec3 uDirLightDirection; // world space
uniform vec3 uDirLightColor;

uniform vec3 uSpecColor;
uniform float uShininess;

uniform vec3 uSpotPosition;   // world space
uniform vec3 uSpotDirection;  // world space, normalized
uniform vec3 uSpotColor;
uniform float uSpotIntensity;
uniform float uSpotCosCutoff; // cos(theta cutoff)

// three.js supplies uniform mat4 viewMatrix;

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(-vPosView);

  // Directional light (transform to view space)
  vec3 Ld = normalize((viewMatrix * vec4(-uDirLightDirection, 0.0)).xyz);
  float diffD = max(dot(N, Ld), 0.0);
  vec3 Hd = normalize(Ld + V);
  float specD = pow(max(dot(N, Hd), 0.0), uShininess);

  vec3 color = uAmbient;
  color += uColor * uDirLightColor * diffD;
  color += uSpecColor * specD;

  // Spotlight (view space)
  vec3 spotPosV = (viewMatrix * vec4(uSpotPosition, 1.0)).xyz;
  vec3 spotDirV = normalize((viewMatrix * vec4(uSpotDirection, 0.0)).xyz);
  vec3 Ls = normalize(vPosView - spotPosV); // from light to fragment
  float cosTheta = dot(spotDirV, Ls);
  float spotMask = smoothstep(uSpotCosCutoff, uSpotCosCutoff + 0.05, cosTheta);

  float diffS = max(dot(N, -Ls), 0.0) * spotMask;
  vec3 Hs = normalize(-Ls + V);
  float specS = pow(max(dot(N, Hs), 0.0), uShininess) * spotMask;

  color += uSpotColor * diffS * uSpotIntensity;
  color += uSpecColor * specS * uSpotIntensity;

  gl_FragColor = vec4(color, 1.0);
}

