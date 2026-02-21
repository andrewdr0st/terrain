import { setupGPUDevice, loadWGSLShader, presentationFormat, context, device } from "./gpuManager.js";
import { mainCamera } from "./camera.js";
import { Chunk, createTerrainMesh, chunkVertexList, chunkIndexList } from "./chunk.js";
import {} from "./inputManager.js";

const canvas = document.getElementById("canvas");

const VERTEX_SIZE = 16;

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

let chunk;

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

async function init() {
    if (!await setupGPUDevice(canvas)) {
        return;
    }
    createTerrainMesh();
    chunk = new Chunk();
    chunk.heightArray[0] = 2.5;
    chunk.heightArray[512 * 512 - 1] = 5.0;
    for (let i = 400; i < 500; i++) {
        for (let j = 300; j < 350; j++) {
            chunk.heightArray[i * 512 + j] = 2.0;
        }
        chunk.heightArray[i * 512 - 1] = 1.5;
    }
    for (let i = 460; i < 510; i++) {
        for (let j = 100; j < 150; j++) {
            chunk.heightArray[i * 512 + j] = -6.0 * ((j - 150) / -50);
        }
    }
    chunk.calculateTerrainNormals();
    chunk.buildBvhHeap();
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
        size: chunkVertexList.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(vertexBuffer, 0, chunkVertexList);
    indexBuffer = device.createBuffer({
        label: "index buffer",
        size: chunkIndexList.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(indexBuffer, 0, chunkIndexList);
    heightTexture = device.createTexture({
        dimension: "2d",
        format: "r16float",
        size: [512, 512],
        usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    });
    device.queue.writeTexture({texture: heightTexture}, chunk.heightArray, {bytesPerRow: 1024}, [512, 512]);
    normalTexture = device.createTexture({
        dimension: "2d",
        format: "rg8snorm",
        size: [512, 512],
        usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    });
    device.queue.writeTexture({texture: normalTexture}, chunk.normalArray, {bytesPerRow: 1024}, [512, 512]);
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
    terrainPass.drawIndexed(1566726);
    terrainPass.end();
    device.queue.submit([encoder.finish()]);
    requestAnimationFrame(main);
}

init();