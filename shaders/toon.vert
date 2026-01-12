precision highp float;

// three.js provides attributes/uniforms for position/normal/matrices.

varying vec3 vNormal;
varying vec3 vPosView;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vPosView = mvPosition.xyz;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mvPosition;
}

