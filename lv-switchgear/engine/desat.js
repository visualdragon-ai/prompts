// Outage wash: paper colour drains to graphite on cream as uD.x sweeps left→right, and floods back outward from uD.z as uD.y grows.
// Shared by every paper material that isn't marked "keep" (the UPS chain stays powered on batteries).
import * as THREE from 'three';
export const UD = { value: new THREE.Vector4(0, 0, -.16, 0) };
export function patchDesat(mat, extra) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (s, r) => {
    if (extra) extra(s, r);
    s.uniforms.uD = UD;
    s.vertexShader = 'varying float vWX;\n' + s.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vWX = (modelMatrix * vec4(transformed, 1.)).x;');
    s.fragmentShader = 'uniform vec4 uD; varying float vWX;\n' + s.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      { float dOut = smoothstep(0., 1., (uD.x * .62 - (vWX + .25)) / .05);
        float dBack = smoothstep(0., 1., (uD.y * .5 - abs(vWX - uD.z)) / .05);
        float d = dOut * (1. - dBack);
        float l = dot(diffuseColor.rgb, vec3(.3, .59, .11));
        vec3 gr = mix(vec3(.26, .27, .31), vec3(.80, .79, .76), smoothstep(.08, .9, l));
        diffuseColor.rgb = mix(diffuseColor.rgb, gr, d * .92); }`);
  };
  mat.customProgramCacheKey = () => 'desat' + (extra ? 'x' : '');
}
