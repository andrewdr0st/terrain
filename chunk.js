const { vec3 } = wgpuMatrix;

const CHUNK_TX_DIM = 512;
const CHUNK_TX_SIZE = CHUNK_TX_DIM * CHUNK_TX_DIM;
const CHUNK_QUAD_DIM = CHUNK_TX_DIM - 1;
const CHUNK_QUAD_COUNT = CHUNK_QUAD_DIM * CHUNK_QUAD_DIM;
const CHUNK_SIZE = 128;
const HEAP_SIZE = 174760;
const BOTTOM_LAYER_SIZE = 65536;
const DEPTH_OFFSETS = [0, 8, 40, 168, 680, 2728, 10920, 43688];
export const chunkVertexList = new Float32Array(4 * CHUNK_TX_SIZE);
export const chunkIndexList = new Uint32Array(6 * CHUNK_QUAD_COUNT);

export class Chunk {
    constructor() {
        this.heightArray = new Float16Array(CHUNK_TX_SIZE);
        this.normalArray = new Int8Array(CHUNK_TX_SIZE * 2);
        this.bvhHeap = new Float16Array(HEAP_SIZE);
    }

    calculateTerrainNormals() {
        let xzDist = CHUNK_SIZE / CHUNK_QUAD_DIM * -2;
        for (let y = 1; y < CHUNK_TX_DIM - 1; y++) {
            for (let x = 1; x < CHUNK_TX_DIM - 1; x++) {
                let idx = x + y * CHUNK_TX_DIM;
                let v1y = this.heightArray[idx + 1] - this.heightArray[idx - 1];
                let v1 = [xzDist, v1y, 0];
                let v2y = this.heightArray[idx + CHUNK_TX_DIM] - this.heightArray[idx - CHUNK_TX_DIM];
                let v2 = [0, v2y, xzDist];
                let normal = vec3.normalize(vec3.cross(v2, v1));
                let xpart = Math.floor(normal[0] * 127);
                let zpart = Math.floor(normal[2] * 127);
                this.normalArray[idx * 2] = xpart;
                this.normalArray[idx * 2 + 1] = zpart;
            }
        }
    }

    buildBvhHeap() {
        for (let i = 0; i < BOTTOM_LAYER_SIZE; i++) {
            let x = unweaveBits(i);
            let y = unweaveBits(i >> 1);
            let heights = [];
            for (let j = 0; j < 3; j++) {
                for (let k = 0; k < 3; k++) {
                    let xOff = 2 * x + k;
                    let yOff = 2 * y + j;
                    if (xOff < CHUNK_TX_DIM && yOff < CHUNK_TX_DIM) {
                        let idx = CHUNK_TX_DIM * yOff + xOff;
                        heights.push(this.heightArray[idx]);
                    }
                }
            }
            let minH = Math.min(...heights);
            let maxH = Math.max(...heights);
            let idx = DEPTH_OFFSETS[7] + i * 2;
            this.bvhHeap[idx] = minH;
            this.bvhHeap[idx + 1] = maxH;
        }
        this.buildBvhHeapRecursive(0, 0);
        this.buildBvhHeapRecursive(2, 0);
        this.buildBvhHeapRecursive(4, 0);
        this.buildBvhHeapRecursive(6, 0);
        console.log(this.bvhHeap);
    }

    buildBvhHeapRecursive(idx, depth) {
        let i = idx + DEPTH_OFFSETS[depth];
        if (i > HEAP_SIZE) {
            console.log(i);
        }
        if (depth < 7) {
            let tidx = idx * 4;
            let q1 = this.buildBvhHeapRecursive(tidx, depth + 1);
            let q2 = this.buildBvhHeapRecursive(tidx + 2, depth + 1);
            let q3 = this.buildBvhHeapRecursive(tidx + 4, depth + 1);
            let q4 = this.buildBvhHeapRecursive(tidx + 6, depth + 1);
            this.bvhHeap[i] = Math.min(q1[0], q2[0], q3[0], q4[0]);
            this.bvhHeap[i + 1] = Math.max(q1[1], q2[1], q3[1], q4[1]);
            if (isNaN(this.bvhHeap[i] && depth == 6)) {
                console.log(idx, depth, unweaveBits(idx));
                console.log(q1, q2, q3, q4);
            }
        }
        return [this.bvhHeap[i], this.bvhHeap[i + 1]];
    }
}

export function createTerrainMesh() {
    for (let y = 0; y < CHUNK_TX_DIM; y++) {
        for (let x = 0; x < CHUNK_TX_DIM; x++) {
            let offset = (y * CHUNK_TX_DIM + x) * 4;
            let u = x / CHUNK_QUAD_DIM;
            let v = y / CHUNK_QUAD_DIM;
            let xp = u * CHUNK_SIZE;
            let yp = v * CHUNK_SIZE;
            chunkVertexList.set([xp, yp, u, v], offset);
        }
    }
    for (let y = 0; y < CHUNK_QUAD_DIM; y++) {
        for (let x = 0; x < CHUNK_QUAD_DIM; x++) {
            let pos = y * CHUNK_TX_DIM + x;
            let offset = (y * CHUNK_QUAD_DIM + x) * 6;
            chunkIndexList.set([pos, pos + CHUNK_TX_DIM, pos + 1, pos + 1, pos + CHUNK_TX_DIM, pos + CHUNK_TX_DIM + 1], offset);
        }
    }
}

function unweaveBits(z) {
    let x = z & 0x5555;
    x = (x | x >> 1) & 0x3333;
    x = (x | x >> 2) & 0x0F0F;
    x = (x | x >> 4) & 0x00FF;
    return x;
}