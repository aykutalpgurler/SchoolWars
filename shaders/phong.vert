precision highp float;

// three.js provides:
// attribute vec3 position;
// attribute vec3 normal;
// uniform mat4 modelViewMatrix;
// uniform mat4 projectionMatrix;
// uniform mat3 normalMatrix;

varying vec3 vNormal;
varying vec3 vPosView;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vPosView = mvPosition.xyz;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mvPosition;
}

