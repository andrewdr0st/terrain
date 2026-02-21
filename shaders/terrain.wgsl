struct Scene {
    viewProjection: mat4x4f
}

struct Vertex {
    @location(0) pos: vec2f,
    @location(1) uv: vec2f
}

struct VsOutput {
    @builtin(position) position: vec4f,
    @location(0) world_pos: vec3f,
    @location(1) uv: vec2f,
    @location(2) normal: vec3f
}

@group(0) @binding(0) var<uniform> scene: Scene;
@group(1) @binding(0) var height_map: texture_2d<f32>;
@group(1) @binding(1) var normal_map: texture_2d<f32>;

@vertex fn vs(vert: Vertex, @builtin(instance_index) inst: u32) -> VsOutput {
    let coords = vec2u(vert.uv * 511);
    let height: f32 = textureLoad(height_map, coords, 0).r;
    let normal_map_read: vec2f = textureLoad(normal_map, coords, 0).rg;
    let normal_y = sqrt(1 - normal_map_read.x * normal_map_read.x - normal_map_read.y * normal_map_read.y);
    let normal = vec3f(normal_map_read.x, normal_y, normal_map_read.y);
    let world_pos = vec3f(vert.pos.x, height, vert.pos.y);
    let pos = scene.viewProjection * vec4f(world_pos, 1);
    return VsOutput(pos, world_pos, vert.uv, normal);
}

@fragment fn fs(fsIn: VsOutput) -> @location(0) vec4f {
    let c = max(dot(fsIn.normal, vec3f(0, 1, 0)), 0);
    return vec4f(c, c, c, 1);
}