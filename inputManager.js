import { mainCamera } from "./camera.js";

let leftPressed = false;
let rightPressed = false;
let middlePressed = false;
/**
 * 0 = Movement
 * 1 = Sculpt
 */
let inputMode = 0;
let forceMove = false;

let panSensitivity = 0.08;
let zoomSensitivity = 0.08;
let spinSensitivity = 0.002;

document.addEventListener("contextmenu", (e) => {
    e.preventDefault();
});

document.addEventListener("mousedown", (e) => {
    if (e.button == 0) {
        leftPressed = true;
    } else if (e.button == 1) {
        middlePressed = true;
    } else if (e.button == 2) {
        rightPressed = true;
    }
});

document.addEventListener("mouseup", (e) => {
    if (e.button == 0) {
        leftPressed = false;
    } else if (e.button == 1) {
        middlePressed = false;
    } else if (e.button == 2) {
        rightPressed = false;
    }
});

document.addEventListener("mousemove", (e) => {
    if (middlePressed || (leftPressed && (inputMode == 0 || forceMove))) {
        mainCamera.pan(-e.movementX * panSensitivity, e.movementY * panSensitivity);
    } else if (rightPressed && (inputMode == 0 || forceMove)) {
        mainCamera.spin(-e.movementX * spinSensitivity, e.movementY * spinSensitivity);
    }
});

document.addEventListener("wheel", (e) => {
    if (inputMode == 0 || forceMove) {
        mainCamera.zoom(-e.deltaY * zoomSensitivity);
    }
});

document.addEventListener("keydown", (e) => {
    if (e.repeat) {
        return;
    }
    if (e.key == "Shift") {
        forceMove = true;
    } else if (e.key == "1") {
        inputMode = 0;
    } else if (e.key == "2") {
        inputMode = 1;
    }
});

document.addEventListener("keyup", (e) => {
    if (e.key == "Shift") {
        forceMove = false;
    }
});
