export let device;
export let context;
export let presentationFormat;

export async function loadWGSLShader(f) {
    let response = await fetch("shaders/" + f);
    return await response.text();
}

export async function loadImage(path) {
    const response = await fetch("textures/" + path);
    const blob = await response.blob();
    return await createImageBitmap(blob);
}

export async function setupGPUDevice(canvas) {
    const adapter = await navigator.gpu?.requestAdapter();
    device = await adapter?.requestDevice();
    if (!device) {
        alert("Need a browser that supports WebGPU");
        return false;
    }

    presentationFormat = navigator.gpu.getPreferredCanvasFormat();

    context = canvas.getContext("webgpu");
    context.configure({
        device,
        format: presentationFormat,
        alphaMode: "premultiplied"
    });

    return true;
}