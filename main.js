import { setupGPUDevice, loadWGSLShader, presentationFormat, context, device } from "./gpuManager.js";
import { Camera } from "./camera.js";

const canvas = document.getElementById("canvas");

const VERTEX_SIZE = 16;
const CHUNK_TX_DIM = 512;
const CHUNK_TX_SIZE = CHUNK_TX_DIM * CHUNK_TX_DIM;
const CHUNK_QUAD_DIM = CHUNK_TX_DIM - 1;
const CHUNK_QUAD_COUNT = CHUNK_QUAD_DIM * CHUNK_QUAD_DIM;
const CHUNK_SIZE = 64;

const VertexList = new Float32Array(4 * CHUNK_TX_SIZE);
const IndexList = new Uint32Array(6 * CHUNK_QUAD_COUNT);

let vertexBuffer;
let indexBuffer;

const VertexDescriptor = {
    arrayStride: 16,
    attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x2" },
        { shaderLocation: 1, offset: 8, format: "float32x2" }
    ]
}

let terrainPipeline;
let terrainDescriptor;
let sceneBuffer;
let sceneLayout;
let sceneBindGroup;
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
let camera = new Camera(canvas.clientWidth / canvas.clientHeight);
camera.lookTo = [0, -1, -1];
camera.position = [32, 32, 80];
camera.updateLookAt();

async function setupTerrainPipeline() {
    let code = await loadWGSLShader("terrain.wgsl");
    let renderModule = device.createShaderModule({code});
    terrainPipeline = device.createRenderPipeline({
        layout: device.createPipelineLayout({
            bindGroupLayouts: [sceneLayout]
        }),
        vertex: {
            buffers: [VertexDescriptor],
            module: renderModule
        },
        fragment: {
            module: renderModule,
            targets: [{ format: presentationFormat }]
        },
        primitive: {
            cullMode: "back"
        },
    });
    terrainDescriptor = {
        colorAttachments: [{
            clearValue: [0, 0, 0, 1],
            loadOp: "clear",
            storeOp: "store"
        }]
    };
}

function createTerrainMesh() {
    for (let y = 0; y < CHUNK_TX_DIM; y++) {
        for (let x = 0; x < CHUNK_TX_DIM; x++) {
            let offset = (y * CHUNK_TX_DIM + x) * 4;
            let u = x / CHUNK_QUAD_DIM;
            let v = y / CHUNK_QUAD_DIM;
            let xp = u * CHUNK_SIZE;
            let yp = v * CHUNK_SIZE;
            VertexList.set([xp, yp, u, v], offset);
        }
    }
    for (let y = 0; y < CHUNK_QUAD_DIM; y++) {
        for (let x = 0; x < CHUNK_QUAD_DIM; x++) {
            let pos = y * CHUNK_QUAD_DIM + x;
            let offset = pos * 6;
            IndexList.set([pos, pos + 1, pos + CHUNK_TX_DIM, pos + 1, pos + CHUNK_TX_DIM + 1, pos + CHUNK_TX_DIM], offset);
        }
    }
}

async function init() {
    if (!await setupGPUDevice(canvas)) {
        return;
    }
    createTerrainMesh();
    sceneLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: {type: "uniform"}
            }
        ]
    });
    await setupTerrainPipeline();
    sceneBuffer = device.createBuffer({
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(sceneBuffer, 0, camera.viewProjectionMatrix);
    sceneBindGroup = device.createBindGroup({
        layout: sceneLayout,
        entries: [
            {binding: 0, resource: {buffer: sceneBuffer}}
        ]
    });
    vertexBuffer = device.createBuffer({
        label: "vertex buffer",
        size: VERTEX_SIZE * CHUNK_TX_SIZE,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(vertexBuffer, 0, VertexList);
    indexBuffer = device.createBuffer({
        label: "index buffer",
        size: 24 * CHUNK_QUAD_COUNT,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(indexBuffer, 0, IndexList);
    requestAnimationFrame(main);
}

async function main(currentTime) {
    terrainDescriptor.colorAttachments[0].view = context.getCurrentTexture().createView();
    const encoder = device.createCommandEncoder();
    const terrainPass = encoder.beginRenderPass(terrainDescriptor);
    terrainPass.setPipeline(terrainPipeline);
    terrainPass.setVertexBuffer(0, vertexBuffer);
    terrainPass.setIndexBuffer(indexBuffer, "uint32");
    terrainPass.setBindGroup(0, sceneBindGroup);
    terrainPass.drawIndexed(CHUNK_QUAD_COUNT * 6);
    terrainPass.end();
    device.queue.submit([encoder.finish()]);
    requestAnimationFrame(main);
}

init();