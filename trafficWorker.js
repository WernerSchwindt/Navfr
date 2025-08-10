importScripts('libs/geodesy-custom-2.3.0.js');

let libsInit = false;
const ownshipPistion = new geodesy.LatLon(0, 0);
const mToNm = 0.000539957;

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

	parseADSBTraffic(e.data);
};

/*
	data structure:
		data["simMode"] = Sim mode true/false
		data["api"] = Domain name
		data["ownshipPos"] = ownship [lat, lon]
		data["qnh"] = qnh
*/
async function parseADSBTraffic(data) {
	try {
		const response = await fetch(data["api"] + '?filename=aircraft');

		if (response.ok) {

			if (response.status != 200) return;

			const result = await response.json();
			const p1 = new geodesy.LatLon(0, 0);

			if(data["ownshipPos"]._lat && data["ownshipPos"]._lon )
			{
				ownshipPistion.lat = data["ownshipPos"]._lat;
				ownshipPistion.lon = data["ownshipPos"]._lon;
			}

			if (result.aircraft) {
				result.aircraft.sort((a, b) => b.rssi - a.rssi);

				result.aircraft = result.aircraft.map((track) => {
					if (track.alt_baro) track.alt_baro = correctBaroAlt(track.alt_baro, track.baro_rate, data["qnh"]);
					if (track.flight){
						if(track.flight.includes("@"))
						{
							track.flight = null;
						}
						else{
							track.flight = track.flight.trim();
						}
					} 
					if (track.rssi) track.rssi = (Math.round(track.rssi * 10) / 10).toFixed(1);

					if (track.lat && track.lon && track.track && track.alt_baro != "Ground") {
						p1.lat = track.lat;
						p1.lon = track.lon;
						const p2 = p1.destinationPoint(track.gs / (mToNm * 60), track.track);
						track.prediction = new ol.proj.fromLonLat([p2.lon, p2.lat]);
					}

					if ((!data["ownshipPos"]._lat || !data["ownshipPos"]._lon || (ownshipPistion.distanceTo(p1) * mToNm < 50)) && track.lat && track.lon) {
						track.mapLonLat = new ol.proj.fromLonLat([track.lon, track.lat]);
					}

					if (track.gs) track.gs = Math.round(track.gs);
					if (track.track) {
						let value = ('00' + Math.round(track.track)).slice(-3);
						track.normalizedTrack = (value == "000") ? "360" : value;
						track.track = toRadians(track.track);
					}

					return track;
				});

				postMessage({"state": 0, "traffic": result.aircraft});
			}
		}
	}
	catch (err) {
		postMessage({"state": 1, "traffic": []});
	}
}

function correctBaroAlt(aircraftAlt, rate, qnh) {
	if (aircraftAlt == "ground") return "Ground";

	let alt = (1 - Math.pow(Math.pow(1 - Number(aircraftAlt) / 145366.45, 5.2553026) * 1013.25 / qnh, 0.190284)) * 145366.45;
	let altText = "";

	if (rate) {
		if (rate > 200) {
			altText += '▲';
		}
		else if (rate < -200) {
			altText += '▼';
		}
	}

	if (alt < 10000) {
		altText += Math.round(alt);
	}
	else {
		(Number(aircraftAlt) >= 10000) ? altText += ("FL" + aircraftAlt).slice(0, 5) : altText += ("FL0" + aircraftAlt).slice(0, 5);
	}

	return altText;
}

function toRadians(degrees) {
	return degrees * Math.PI / 180;
}