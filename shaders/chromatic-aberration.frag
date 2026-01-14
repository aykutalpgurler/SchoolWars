uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform float uAberrationStrength;
uniform float uDistortionStrength;

varying vec2 vUv;

void main() {
    // Calculate center and distance from center
    vec2 center = vec2(0.5, 0.5);
    vec2 uv = vUv;
    vec2 dir = uv - center;
    float dist = length(dir);
    
    // Normalize direction
    vec2 dirNorm = dist > 0.0 ? dir / dist : vec2(0.0);
    
    // Apply radial distortion (barrel distortion)
    float distortion = 1.0 + uDistortionStrength * dist * dist;
    vec2 distortedUv = center + dir * distortion;
    
    // Calculate chromatic aberration offset (stronger at edges)
    float aberrationAmount = uAberrationStrength * dist * dist;
    vec2 offset = dirNorm * aberrationAmount;
    
    // Sample RGB channels with different offsets (clamp to prevent artifacts)
    float r = texture2D(tDiffuse, clamp(distortedUv + offset, vec2(0.0), vec2(1.0))).r;
    float g = texture2D(tDiffuse, clamp(distortedUv, vec2(0.0), vec2(1.0))).g;
    float b = texture2D(tDiffuse, clamp(distortedUv - offset, vec2(0.0), vec2(1.0))).b;
    
    // Get alpha from center sample
    float a = texture2D(tDiffuse, distortedUv).a;
    
    gl_FragColor = vec4(r, g, b, a);
}

