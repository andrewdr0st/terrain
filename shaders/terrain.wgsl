struct Scene {
    viewProjection: mat4x4f
}

struct Vertex {
    @location(0) pos: vec2f,
    @location(1) uv: vec2f
}

struct VsOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f
}

@group(0) @binding(0) var<uniform> scene: Scene;

@vertex fn vs(vert: Vertex, @builtin(instance_index) inst: u32) -> VsOutput {
    let height: f32 = 0;
    let pos = scene.viewProjection * vec4f(vert.pos.x, height, vert.pos.y, 1);
    return VsOutput(pos, vert.uv);
}

@fragment fn fs(fsIn: VsOutput) -> @location(0) vec4f {
    return vec4f(0.25, fsIn.uv.x, fsIn.uv.y, 1);
}