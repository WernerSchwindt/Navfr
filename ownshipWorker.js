"use strict";

let workerGeoMag = null;
let navPoint = null;
let lastPosition = null;

let workerLibsInit = false;
let workerOwnship = {};
let workerRenderPars = {};
let firstPosition = true;
let WorkerSpeedSamples = [];
let airborneCount = 3;
let hours = 0;
let workerAirborneMode = false;
let fixTime = null;
let lastFixTime = null;
let deltaTime = null;
let workerAverageSpeed = null;

workerOwnship.gs = null;
workerOwnship.aveGs = null;
workerOwnship.track = null;
workerOwnship.magVar = null;
workerOwnship.mapPosition = null;
workerOwnship.ete = [];
workerOwnship.routeFuelReq = null;
workerOwnship.totalFuel = null;
workerOwnship.toGoDis = null;
workerOwnship.toGoDtk = null;
workerOwnship.toGs = null;

workerRenderPars.radTrack = null;
workerRenderPars.radMagVar = null;
workerRenderPars.radDtk = null;
workerRenderPars.radWind = null;

onmessage = (e) => {
	if (!workerLibsInit) {
		importScripts('libs/ol-custom-10.6.1.js');
		importScripts('libs/geodesy-custom-2.3.0.js');
		importScripts('libs/geomag2020.js');
		importScripts('utilities.js');
		importScripts('defaults.js');
	}

	updateOwnship(e.data);
};

/*
	data structure:
		data["simMode"] = sim mode. 
		data["ownshipPos"] = ownship [lat, lon] Note: either from GPS of from Sim.
		data["navPoint"] = newpoint [lat, lon]
		data["sectionFuelFlow"] = fuel flow
		data["ownshipFuel"] = total fuel
		data["sectionWindDir"] = windDir
*/
function updateOwnship(data) {

	if (!workerLibsInit) {
		workerLibsInit = true;
		workerGeoMag = geoMagFactory(cof2Obj());
		navPoint = new geodesy.LatLon(0, 0);
		lastPosition = new geodesy.LatLon(0, 0);
		workerOwnship.position = new geodesy.LatLon(0, 0);
		workerOwnship.prediction = new geodesy.LatLon(0, 0);
	}

	const localDate = new Date();
	fixTime = localDate.getTime();
	workerOwnship.totalFuel = data["ownshipFuel"];
	workerOwnship.position.lat = data["ownshipPos"][1];
	workerOwnship.position.lon = data["ownshipPos"][0];

	if (!firstPosition) {
		deltaTime = fixTime - lastFixTime;
		workerOwnship.gs = lastPosition.distanceTo(workerOwnship.position) * mToNm * 3600000 / deltaTime;
		workerOwnship.track = lastPosition.initialBearingTo(workerOwnship.position);
		if (isNaN(workerOwnship.track)) workerOwnship.track = 0;
		workerOwnship.magVar = workerGeoMag(workerOwnship.position.lat, workerOwnship.position.lon).dec;
		workerOwnship.mapPosition = ol.proj.fromLonLat([workerOwnship.position.lon, workerOwnship.position.lat]);

		const p1 = workerOwnship.position.destinationPoint(workerOwnship.gs / (mToNm * 60), workerOwnship.track);
		workerOwnship.prediction = new ol.proj.fromLonLat([p1.lon, p1.lat]);

		WorkerSpeedSamples[WorkerSpeedSamples.length] = workerOwnship.gs;

		if (WorkerSpeedSamples.length > 30) WorkerSpeedSamples.shift();

		if (workerOwnship.gs > 30 && airborneCount > 0) {
			airborneCount--;
		}

		if (airborneCount == 0 && !workerAirborneMode) {
			workerAirborneMode = true;
		}

		if (workerAirborneMode && data["navPoint"]) {
			navPoint.lat = data["navPoint"]._lat;
			navPoint.lon = data["navPoint"]._lon;

			workerOwnship.toGoDis = workerOwnship.position.distanceTo(navPoint) * mToNm;
			workerOwnship.toGoDtk = normalizeAngle(workerOwnship.position.initialBearingTo(navPoint) - workerOwnship.magVar);

			workerAverageSpeed = 0;

			for (let i = 0; i < WorkerSpeedSamples.length; i++) {
				workerAverageSpeed += WorkerSpeedSamples[i];
			}

			workerAverageSpeed = workerAverageSpeed / WorkerSpeedSamples.length;
			workerOwnship.aveGs = workerAverageSpeed;
			workerOwnship.toGs = Math.max(10, workerAverageSpeed * Math.cos(toRadians(workerOwnship.track - workerOwnship.magVar - workerOwnship.toGoDtk)));
			hours = workerOwnship.toGoDis / workerOwnship.toGs;
			workerOwnship.ete = [Math.floor(hours), (hours - Math.floor(hours)) * 60];

			if (data["sectionFuelFlow"]) {
				workerOwnship.routeFuelReq = data["sectionFuelFlow"] * (workerOwnship.ete[0] + (workerOwnship.ete[1] / 60));
				workerOwnship.totalFuel -= data["sectionFuelFlow"] * deltaTime / 3600000;
			}
		}

		workerRenderPars.radTrack = toRadians(workerOwnship.track);
		workerRenderPars.radMagVar = toRadians(workerOwnship.magVar);
		workerRenderPars.radDtk = (workerOwnship.toGoDtk) ? workerRenderPars.radMagVar + toRadians(workerOwnship.toGoDtk) : null;
		workerRenderPars.radWind = (data["sectionWindDir"]) ? toRadians(data["sectionWindDir"]) + workerRenderPars.radMagVar : null;
	}

	lastPosition.lat = workerOwnship.position.lat;
	lastPosition.lon = workerOwnship.position.lon;
	lastFixTime = fixTime;

	if (firstPosition) {
		firstPosition = false;
	}
	else {
		if(!data["simMode"]){
			postMessage({ "airborneMode": workerAirborneMode, "ownship": workerOwnship, "renderPars": workerRenderPars, "deltaTime": deltaTime });
		}else{
			processOwnship({ "airborneMode": workerAirborneMode, "ownship": workerOwnship, "renderPars": workerRenderPars, "deltaTime": deltaTime });
		}
	}
}