"use strict";

function SectorObject(mapPoint) {
	this.sectorName = "N/A";
	this.id = null;
	this.mapPoint = mapPoint;
	this.latlong = ol.proj.toLonLat(mapPoint);
	this.magBearing = null;
	this.distance = null;
	this.ias = null;
	this.altitude = null;
	this.windDir = null;
	this.windSpd = null;
	this.groundSpeed = null;
	this.heading = null;
	this.fuelFlow = null;
	this.fuelRequired = null;
	this.ete = [];
	this.endPoint = new geodesy.LatLon(this.latlong[1], this.latlong[0]);
	this.midPoint = null;
	this.trueBearing = null;
}

SectorObject.prototype.setNull = function () {
	this.sectorName = null;
	this.id = null;
	this.mapPoint = null;
	this.latlong = null;
	this.magBearing = null;
	this.distance = null;
	this.ias = null;
	this.altitude = null;
	this.windDir = null;
	this.windSpd = null;
	this.groundSpeed = null;
	this.heading = null;
	this.fuelFlow = null;
	this.fuelRequired = null;
	this.ete = null;
	this.endPoint = null;
	this.midPoint = null;
	this.trueBearing = null;
}

SectorObject.prototype.clone = function (copy) {
	this.sectorName = copy.sectorName;
	this.id = copy.id;
	this.mapPoint = copy.mapPoint;
	this.latlong = copy.latlong;
	this.magBearing = copy.magBearing;
	this.distance = copy.distance;
	this.ias = copy.ias;
	this.altitude = copy.altitude;
	this.windDir = copy.windDir;
	this.windSpd = copy.windSpd;
	this.groundSpeed = copy.groundSpeed;
	this.heading = copy.heading;
	this.fuelFlow = copy.fuelFlow;
	this.fuelRequired = copy.fuelRequired;
	this.ete = copy.ete;
	this.endPoint = new geodesy.LatLon(copy.endPoint._lat, copy.endPoint._lon);
	this.midPoint = (copy.midPoint) ? new geodesy.LatLon(copy.midPoint._lat, copy.midPoint._lon) : null;
	this.trueBearing = copy.trueBearing;
}

SectorObject.prototype.calculateWindCorrection = function () {
	if (this.ias == null || this.windSpd == null || this.windDir == null) {
		return;
	}

	// Convert angles to radians
	const windAngleRad = toRadians(this.windDir - this.magBearing);
	const crsRad = toRadians(this.magBearing);

	// Calculate the crosswind
	const crosswind = this.windSpd * Math.sin(windAngleRad);
	const headwind = this.windSpd * Math.cos(windAngleRad);

	// Calculate the drift angle and ground speed
	const driftAngle = Math.asin(crosswind / this.ias);
	this.groundSpeed = (this.ias * Math.cos(driftAngle)) - headwind;

	// Convert back to degrees and normalize to 0-360 range
	this.heading = normalizeAngle(toDegrees(crsRad + driftAngle));

	// Calculate sector ete
	if (this.groundSpeed > 30) {
		const hours = this.distance / this.groundSpeed;
		this.ete = [Math.floor(hours), (hours - Math.floor(hours)) * 60];
	}
}

SectorObject.prototype.calculateWind = function (course, groundspeed) {
	if (this.heading == null || groundspeed == null || this.ias == null || course == null) {
		return;
	}

	const courseRad = toRadians(course);
	const driftAngle = toRadians(this.heading - course);

	const headwind = (this.ias * Math.cos(driftAngle)) - groundspeed;
	const crosswind = this.ias * Math.sin(driftAngle);

	if (headwind == 0) {
		this.windSpd = (crosswind < 0) ? -crosswind : crosswind;
		this.windDir = normalizeAngle((crosswind < 0) ? course - 90 : course + 90);
	}
	else {
		const windAngle = Math.atan(crosswind / headwind);
		const speed = headwind / Math.cos(windAngle);

		this.windSpd = (speed < 0) ? -speed : speed;

		this.windDir = normalizeAngle(course + toDegrees(windAngle) + ((speed < 0) ? 180 : 0));
	}
}

function toRadians(degrees) {
	return degrees * Math.PI / 180;
}

function toDegrees(radians) {
	return radians * 180 / Math.PI;
}

function normalizeAngle(angle) {
	// Use modulo to get the angle within 0-360 (or -359 to 359)
	let normalizedAngle = angle % 360;

	// If the angle is negative, add 360 to make it positive
	if (normalizedAngle < 0) normalizedAngle += 360;

	return normalizedAngle;
}