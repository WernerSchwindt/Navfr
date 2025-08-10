importScripts('libs/geodesy-custom-2.3.0.js');
importScripts('libs/geomag2020.js');

const mToNm = 0.000539957;
const geoMag = geoMagFactory(cof2Obj());
const navPoint = new geodesy.LatLon(0, 0);
const lastPosition = new geodesy.LatLon(0, 0);

let libsInit = false;
let ownship = {};
let renderPars = {};
let firstPosition = true;
let speedSamples = [];
let airborneCount = 3;
let hours = 0;
let airborneMode = false;
let fixTime = null;
let lastFixTime = null;
let deltaTime = null;

ownship.position = new geodesy.LatLon(0, 0);

ownship.gs = null;
ownship.track = null;
ownship.magVar = null;
ownship.mapPosition = null;
ownship.atd = null;
ownship.ete = null;
ownship.routeFuelReq = null;
ownship.totalFuel = null;
ownship.toGoDis = null;
ownship.toGoDtk = null;
ownship.toGs = null;

renderPars.radTrack = null;
renderPars.radMagVar = null;
renderPars.radDtk = null;

onmessage = (e) => {
	if (!libsInit) {
		libsInit = true;

		if (e.data["simMode"]) {
			importScripts('libs/ol-custom-6.15.1.js');
		}
		else {
			importScripts('libs/ol-custom-10.6.0.js');
		}
	}

	updateOwnship(e.data);
};


/*
	data structure:
		data["simMode"] = sim mode. 
		data["ownshipPos"] = ownship [lat, lon] Note: either from GPS of from Sim.
		data["navPoint"] = newpoint [lat, lon]
		data["sectionFuelFlow"] = fuel flow
*/
function updateOwnship(data) {

	const localDate = new Date();
	fixTime = localDate.getTime();
	ownship.totalFuel = data["ownshipFuel"];
	ownship.position.lat = data["ownshipPos"][1];
	ownship.position.lon = data["ownshipPos"][0];

	if (!firstPosition) {
		deltaTime = fixTime - lastFixTime;
		ownship.gs = lastPosition.distanceTo(ownship.position) * mToNm * 3600000 / deltaTime;
		ownship.track = lastPosition.initialBearingTo(ownship.position);
		if (isNaN(ownship.track)) ownship.track = 0;
		ownship.magVar = geoMag(ownship.position.lat, ownship.position.lon).dec;
		ownship.mapPosition = ol.proj.fromLonLat([ownship.position.lon, ownship.position.lat]);

		speedSamples[speedSamples.length] = ownship.gs;

		if (speedSamples.length > 30) speedSamples.shift();

		if (ownship.gs > 30 && airborneCount > 0) {
			airborneCount--;
		}

		if (airborneCount == 0 && !airborneMode) {
			airborneMode = true;
		}

		if (airborneMode && !ownship.atd) {
			ownship.atd = [localDate.getUTCHours(), localDate.getUTCMinutes() + (localDate.getUTCSeconds() / 60)];
		}

		if (airborneMode && data["navPoint"] && data["sectionFuelFlow"]) {
			navPoint.lat = data["navPoint"]._lat;
			navPoint.lon = data["navPoint"]._lon;

			ownship.toGoDis = ownship.position.distanceTo(navPoint) * mToNm;
			ownship.toGoDtk = normalizeAngle(ownship.position.initialBearingTo(navPoint) - ownship.magVar);

			averageSpeed = 0;

			for (let i = 0; i < speedSamples.length; i++) {
				averageSpeed += speedSamples[i];
			}

			averageSpeed = averageSpeed / speedSamples.length;
			ownship.toGs = Math.max(10, averageSpeed * Math.cos(toRadians(ownship.track - ownship.magVar - ownship.toGoDtk)));
			hours = ownship.toGoDis / ownship.toGs;
			ownship.ete = [Math.floor(hours), (hours - Math.floor(hours)) * 60];

			if (data["sectionFuelFlow"]) {
				ownship.routeFuelReq = data["sectionFuelFlow"] * (ownship.ete[0] + (ownship.ete[1] / 60));
				ownship.totalFuel -= data["sectionFuelFlow"] * deltaTime / 3600000;
			}
		}

		renderPars.radTrack = toRadians(ownship.track);
		renderPars.radMagVar = toRadians(ownship.magVar);
		renderPars.radDtk = (ownship.toGoDtk) ? renderPars.radMagVar + toRadians(ownship.toGoDtk) : null;
	}

	lastPosition.lat = ownship.position.lat;
	lastPosition.lon = ownship.position.lon;
	lastFixTime = fixTime;

	if (firstPosition) {
		firstPosition = false;
	}
	else {
		postMessage({ "airborneMode": airborneMode, "ownship": ownship, "renderPars": renderPars, "deltaTime": deltaTime});
	}
}

function toRadians(degrees) {
	return degrees * Math.PI / 180;
}

function normalizeAngle(angle) {
	// Use modulo to get the angle within 0-360 (or -359 to 359)
	let normalizedAngle = angle % 360;

	// If the angle is negative, add 360 to make it positive
	if (normalizedAngle < 0) normalizedAngle += 360;

	return normalizedAngle;
}