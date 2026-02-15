import { setupGPUDevice, loadWGSLShader, presentationFormat, context, device } from "./gpuManager.js";
import { mainCamera } from "./camera.js";
import {} from "./inputManager.js";
const { vec3 } = wgpuMatrix;

const canvas = document.getElementById("canvas");

const VERTEX_SIZE = 16;
const CHUNK_TX_DIM = 512;
const CHUNK_TX_SIZE = CHUNK_TX_DIM * CHUNK_TX_DIM;
const CHUNK_QUAD_DIM = CHUNK_TX_DIM - 1;
const CHUNK_QUAD_COUNT = CHUNK_QUAD_DIM * CHUNK_QUAD_DIM;
const CHUNK_SIZE = 64;

const VertexList = new Float32Array(4 * CHUNK_TX_SIZE);
const IndexList = new Uint32Array(6 * CHUNK_QUAD_COUNT);

const HeightArray = new Float16Array(CHUNK_TX_SIZE);
const NormalArray = new Int8Array(CHUNK_TX_SIZE * 2);

let vertexBuffer;
let indexBuffer;

const VertexDescriptor = {
    arrayStride: 16,
    attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x2" },
        { shaderLocation: 1, offset: 8, format: "float32x2" }
    ]
}

let depthTexture;

let terrainPipeline;
let terrainDescriptor;

let sceneBuffer;
let sceneLayout;
let sceneBindGroup;

let heightTexture;
let normalTexture;
let terrainTextureLayout;
let terrainTextureBindGroup;

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
mainCamera.setAspectRatio(canvas.width / canvas.height);
mainCamera.updateLookAt();

async function setupTerrainPipeline() {
    let code = await loadWGSLShader("terrain.wgsl");
    let renderModule = device.createShaderModule({code});
    terrainPipeline = device.createRenderPipeline({
        layout: device.createPipelineLayout({
            bindGroupLayouts: [sceneLayout, terrainTextureLayout]
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
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: "less",
            format: "depth24plus"
        }
    });
    terrainDescriptor = {
        colorAttachments: [{
            clearValue: [0, 0, 0, 1],
            loadOp: "clear",
            storeOp: "store"
        }],
        depthStencilAttachment: {
            view: depthTexture.createView(),
            depthClearValue: 1.0,
            depthLoadOp: "clear",
            depthStoreOp: "store"
        }
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
            IndexList.set([pos, pos + CHUNK_TX_DIM, pos + 1, pos + 1, pos + CHUNK_TX_DIM, pos + CHUNK_TX_DIM + 1], offset);
        }
    }
}

function calculateTerrainNormals() {
    let xzDist = CHUNK_SIZE / CHUNK_QUAD_DIM * -2;
    for (let y = 1; y < CHUNK_TX_DIM - 1; y++) {
        for (let x = 1; x < CHUNK_TX_DIM - 1; x++) {
            let idx = x + y * CHUNK_TX_DIM;
            let v1y = HeightArray[idx + 1] - HeightArray[idx - 1];
            let v1 = [xzDist, v1y, 0];
            let v2y = HeightArray[idx + CHUNK_TX_DIM] - HeightArray[idx - CHUNK_TX_DIM];
            let v2 = [0, v2y, xzDist];
            let normal = vec3.normalize(vec3.cross(v2, v1));
            let xpart = Math.floor(normal[0] * 127);
            let zpart = Math.floor(normal[2] * 127);
            NormalArray[idx * 2] = xpart;
            NormalArray[idx * 2 + 1] = zpart;
        }
    }
}

async function init() {
    if (!await setupGPUDevice(canvas)) {
        return;
    }
    createTerrainMesh();
    for (let i = 400; i < 500; i++) {
        for (let j = 300; j < 350; j++) {
            HeightArray[i * 512 + j] = 2.0;
        }
    }
    for (let i = 460; i < 500; i++) {
        for (let j = 100; j < 150; j++) {
            HeightArray[i * 512 + j] = -6.0 * ((j - 150) / -50);
        }
    }
    calculateTerrainNormals();
    sceneLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: {type: "uniform"}
            }
        ]
    });
    terrainTextureLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                texture: { sampleType: "float" }
            }, {
                binding: 1,
                visibility: GPUShaderStage.VERTEX,
                texture: { sampleType: "float" }
            }
        ]
    });
    depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
    await setupTerrainPipeline();
    sceneBuffer = device.createBuffer({
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(sceneBuffer, 0, mainCamera.viewProjectionMatrix);
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
    heightTexture = device.createTexture({
        dimension: "2d",
        format: "r16float",
        size: [512, 512],
        usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    });
    device.queue.writeTexture({texture: heightTexture}, HeightArray, {bytesPerRow: 1024}, [512, 512]);
    normalTexture = device.createTexture({
        dimension: "2d",
        format: "rg8snorm",
        size: [512, 512],
        usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    });
    device.queue.writeTexture({texture: normalTexture}, NormalArray, {bytesPerRow: 1024}, [512, 512]);
    terrainTextureBindGroup = device.createBindGroup({
        layout: terrainTextureLayout,
        entries: [
            {binding: 0, resource: heightTexture.createView()},
            {binding: 1, resource: normalTexture.createView()}
        ]
    });
    requestAnimationFrame(main);
}

async function main(currentTime) {
    mainCamera.updateLookAt();
    device.queue.writeBuffer(sceneBuffer, 0, mainCamera.viewProjectionMatrix);
    terrainDescriptor.colorAttachments[0].view = context.getCurrentTexture().createView();
    const encoder = device.createCommandEncoder();
    const terrainPass = encoder.beginRenderPass(terrainDescriptor);
    terrainPass.setPipeline(terrainPipeline);
    terrainPass.setVertexBuffer(0, vertexBuffer);
    terrainPass.setIndexBuffer(indexBuffer, "uint32");
    terrainPass.setBindGroup(0, sceneBindGroup);
    terrainPass.setBindGroup(1, terrainTextureBindGroup);
    terrainPass.drawIndexed(CHUNK_QUAD_COUNT * 6);
    terrainPass.end();
    device.queue.submit([encoder.finish()]);
    requestAnimationFrame(main);
}

init();