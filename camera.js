const { vec3, mat4, utils } = wgpuMatrix;

export class Camera {
    constructor() {
        this.position = [0, 0, 0];
        this.lookTo = [0, 0, -1];
        this.lookAt = [0, 0, 0];
        this.zoomDist = -50;
        this.minZoom = -20;
        this.maxZoom = -100;
        this.theta = Math.PI;
        this.phi = Math.PI * 0.25;
        this.minPhi = Math.PI * 0.05;
        this.maxPhi = Math.PI * 0.45;
        this.up = [0, 1, 0];
        this.aspectRatio = 1;
        this.forward;
        this.right;
        this.viewMatrix;
        this.projectionMatrix;
        this.viewProjectionMatrix;
        this.viewProjectionInverse;
        this.zNear = 0.1;
        this.zFar = 1000;
        this.setFov(60);
        this.setLookTo();
    }

    updateLookAt() {
        this.viewMatrix = mat4.lookAt(this.position, this.lookAt, this.up);
        this.viewProjectionMatrix = mat4.multiply(this.projectionMatrix, this.viewMatrix);
        this.viewProjectionInverse = mat4.inverse(this.viewProjectionMatrix);
    }

    updatePosition() {
        const offsetVec = vec3.scale(this.lookTo, this.zoomDist);
        this.position = vec3.add(this.lookAt, offsetVec);
    }

    setLookTo() {
        this.lookTo = [Math.sin(this.theta) * Math.cos(this.phi), -Math.sin(this.phi), Math.cos(this.theta) * Math.cos(this.phi)];
        this.right = vec3.normalize(vec3.cross(this.lookTo, this.up));
        this.forward = vec3.normalize(vec3.cross(this.up, this.right));
        this.updatePosition();
    }

    setAspectRatio(aspectRatio) {
        this.aspectRatio = aspectRatio;
        this.projectionMatrix = mat4.perspective(this.fov, this.aspectRatio, this.zNear, this.zFar);
    }

    setFov(theta) {
        this.fov = utils.degToRad(theta);
        this.projectionMatrix = mat4.perspective(this.fov, this.aspectRatio, this.zNear, this.zFar);
    }

    pan(x, z) {
        const panScale = this.zoomDist / this.maxZoom;
        const xMove = vec3.scale(this.right, x * panScale);
        const zMove = vec3.scale(this.forward, z * panScale);
        const move = vec3.add(xMove, zMove);
        this.lookAt = vec3.add(this.lookAt, move);
        this.updatePosition();
    }

    zoom(amount) {
        this.zoomDist += amount;
        this.zoomDist = Math.max(Math.min(this.zoomDist, this.minZoom), this.maxZoom);
        this.updatePosition();
    }

    spin(theta, phi) {
        this.theta += theta;
        if (this.theta > Math.PI) {
            this.theta -= Math.PI * 2;
        } else if (this.theta < -Math.PI) {
            this.theta += Math.PI * 2;
        }
        this.phi = Math.min(Math.max(this.phi + phi, this.minPhi), this.maxPhi);
        this.setLookTo();
    }
}

export const mainCamera = new Camera();