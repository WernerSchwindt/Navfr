"use strict";

function toRadians(degrees) {
    return degrees * Math.PI / 180;
}

function toDegrees(radians) {
    return radians * 180 / Math.PI;
}

function normalizeAngle(angle) {
    let normalizedAngle = angle % 360;

    if (normalizedAngle < 0) normalizedAngle += 360;

    return normalizedAngle;
}