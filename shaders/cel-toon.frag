uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform float uQuantizationLevels;
uniform float uEdgeThreshold;

varying vec2 vUv;

// Sobel edge detection
float sobelEdge(vec2 uv) {
    vec2 texelSize = 1.0 / uResolution;
    
    // Sample neighboring pixels
    float tl = length(texture2D(tDiffuse, uv + vec2(-texelSize.x, -texelSize.y)).rgb);
    float tm = length(texture2D(tDiffuse, uv + vec2(0.0, -texelSize.y)).rgb);
    float tr = length(texture2D(tDiffuse, uv + vec2(texelSize.x, -texelSize.y)).rgb);
    float ml = length(texture2D(tDiffuse, uv + vec2(-texelSize.x, 0.0)).rgb);
    float mm = length(texture2D(tDiffuse, uv).rgb);
    float mr = length(texture2D(tDiffuse, uv + vec2(texelSize.x, 0.0)).rgb);
    float bl = length(texture2D(tDiffuse, uv + vec2(-texelSize.x, texelSize.y)).rgb);
    float bm = length(texture2D(tDiffuse, uv + vec2(0.0, texelSize.y)).rgb);
    float br = length(texture2D(tDiffuse, uv + vec2(texelSize.x, texelSize.y)).rgb);
    
    // Sobel kernels
    float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
    float gy = -tl - 2.0 * tm - tr + bl + 2.0 * bm + br;
    
    float edge = sqrt(gx * gx + gy * gy);
    return step(uEdgeThreshold, edge);
}

void main() {
    vec4 color = texture2D(tDiffuse, vUv);
    
    // Color quantization (cel shading effect)
    vec3 quantized = floor(color.rgb * uQuantizationLevels) / uQuantizationLevels;
    
    // Edge detection
    float edge = sobelEdge(vUv);
    
    // Combine: darken edges, use quantized color otherwise
    vec3 finalColor = mix(quantized, vec3(0.0), edge * 0.8);
    
    gl_FragColor = vec4(finalColor, color.a);
}

