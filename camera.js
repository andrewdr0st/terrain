const { vec3, mat4, utils } = wgpuMatrix;

export class Camera {
    constructor(aspectRatio) {
        this.position = [0, 0, 0];
        this.lookTo = [0, 0, -1];
        this.lookAt = [0, 0, 0];
        this.up = [0, 1, 0];
        this.aspectRatio = aspectRatio;
        this.forward;
        this.right;
        this.viewMatrix;
        this.viewProjectionMatrix;
        this.zNear = 0.1;
        this.zFar = 1000;
        this.setFov(60);
        this.updateLookAt();
    }

    updateLookAt() {
        this.lookTo = vec3.normalize(this.lookTo);
        this.lookAt = vec3.add(this.position, this.lookTo);
        this.right = vec3.normalize(vec3.cross(this.lookTo, this.up));
        this.forward = vec3.normalize(vec3.cross(this.up, this.right));
        const projection = mat4.perspective(this.fov, this.aspectRatio, this.zNear, this.zFar);
        this.viewMatrix = mat4.lookAt(this.position, this.lookAt, this.up);
        this.viewProjectionMatrix = mat4.multiply(projection, this.viewMatrix);
    }

    setFov(theta) {
        this.fov = utils.degToRad(theta);
    }
}