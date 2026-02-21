import { mainCamera } from "./camera.js";
const { vec3, vec4 } = wgpuMatrix;

function performRaycast(x, y) {
    const rayStart = vec4.transformMat4([x, y, -1, 1], mainCamera.viewProjectionInverse);
    const rayEnd = vec4.transformMat4([x, y, 1, 1], mainCamera.viewProjectionInverse);
    const orig = [rayStart[0], rayStart[1], rayStart[2]];
    const dir = vec3.normalize(vec3.sub([rayEnd[0], rayEnd[1], rayEnd[2]], orig));
}

