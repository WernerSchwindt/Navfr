"use strict";

let date = null;
let layers = null;
let layersGroup = null;
let OLMap = null;
let timers = {};
let trafficLayer = null;
let ownshipLayer = null;
let routeSource = new ol.source.Vector();
let ownshipSource = new ol.source.Vector();
let trafficSource = new ol.source.Vector();
let route = [];
let completedRoute = [];
let geoMag = null;
let currZoom = null;
let snap = true;
let flightPlanValidated = null;
let fuelPlanValidated = null;
let wakeLock = null;
let ownship = {};
let renderPars = {};
let gpsWatchID = null;
let ownshipShape = null;
let airborneCount = 3;
let airborneMode = null;
let canRemoveWaypoint = null;
let globalScale = 1;
let airpotList = null;
let styleArrey = [];
let speedSamples = [];
let averageSpeed = null;

let testMode = false;
let simMode = false;
let firstPosition = true;

//Map settings
let northUp = true;
let panMode = true;
let animate = false;

// Ownship
let viewPoint = new ol.geom.Point([0, 0]);
let ownshipSVG = null;
let compassSVG = null;
let trackSVG = null;
let trackBugSVG = null;
let trafficSVG = null;
let groundTrafficSVG = null;
let highTrafficSVG = null;
let ownshipIcon = null;

let qnh = 1013.25;

const mToNm = 0.000539957;
const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function initialize() {
	if (params.get("test")) {
		testMode = true;
	}

	if (params.get("sim")) {
		simMode = true;
	}

	if (localStorage.getItem("globalScale")) {
		globalScale = Number(localStorage.getItem("globalScale"));
	}

	document.documentElement.style.setProperty("--SCALE", globalScale);
	jQuery('#zoom').text(getDecimalText(globalScale));

	initMap();
	initEvents();
	initTimers();
	initIcons();
	initButtons();
	initOverlaySVGs();

	geoMag = geoMagFactory(cof2Obj());

	ownship.position = new geodesy.LatLon(0, 0);
	ownship.mapPosition = null;
	ownship.fixTime = null;
	ownship.lastPosition = new geodesy.LatLon(0, 0);
	ownship.lastFixTime = null;
	ownship.gs = null;
	ownship.track = null;
	ownship.magVar = null;
	ownship.toGoDis = null;
	ownship.prevToGoDis = null;
	ownship.toGoDtk = null;
	ownship.toGs = null;
	ownship.atd = null;
	ownship.etd = [];
	ownship.ete = [];
	ownship.gpsAccuracy = null;
	ownship.totalFuel = 0;
	ownship.routeFuelReq = null;
	ownship.reserveFuel = null;
	ownship.reserveFuelFlow = null;
	ownship.reserveDuration = 30;
	ownship.holdFuel = null;
	ownship.holdFuelFlow = 0;
	ownship.holdDuration = 0;

	styleArrey[0] = new ol.style.Style({
		image: new ol.style.Circle({
			radius: 153 * globalScale,
			stroke: new ol.style.Stroke({ color: [255, 255, 255, 0.8], width: 32 * globalScale }),
		}),
		zIndex: 180,
	});

	airborneMode = false;
	canRemoveWaypoint = false;

	if ("geolocation" in navigator) {
		let options = {
			enableHighAccuracy: true,
			timeout: 60000,
			maximumAge: 0,
		};

		gpsWatchID = navigator.geolocation.watchPosition(updateOwnship, gpsError, options);
	}

	if (localStorage.getItem("currentFlightPlan")) loadFlightPlanFromServer(localStorage.getItem("currentFlightPlan"));

	loadAirportsFromServer();
}

/*Initiate Section */
function initIcons() {
	document.getElementById('center').innerHTML = svgShapeToSVG(ui['center'], '#ffffff', '#000000', overlayButtonSize * globalScale);
	document.getElementById('north_up').innerHTML = svgShapeToSVG(ui['plane'], '#ffffff', '#000000', overlayButtonSize * globalScale);
	document.getElementById('maps').innerHTML = svgShapeToSVG(ui['map'], '#ffffff', '#000000', overlayButtonSize * globalScale);
	document.getElementById('open_fuel_plan').innerHTML = svgShapeToSVG(ui['fuel'], '#ffffff', '#000000', mainButtonSize * globalScale);
	document.getElementById('open_flight_plan').innerHTML = svgShapeToSVG(ui['takeoff'], '#ffffff', '#000000', mainButtonSize * globalScale);
	document.getElementById('direct_to').innerHTML = svgShapeToSVG(ui['direct'], '#ffffff', '#000000', mainButtonSize * globalScale);
	document.getElementById('open_airport_info').innerHTML = svgShapeToSVG(ui['runway'], '#ffffff', '#000000', mainButtonSize * globalScale);
	document.getElementById('open_menu').innerHTML = svgShapeToSVG(ui['bars'], '#ffffff', '#000000', mainButtonSize * globalScale);
	document.getElementById('close_menu').innerHTML = svgShapeToSVG(ui['cross'], '#ffffff', '#000000', mainButtonSize * globalScale);
	document.getElementById('show_menu_setting_buttons').innerHTML = svgShapeToSVG(ui['gear'], '#ffffff', '#000000', mainButtonSize * globalScale);
	document.getElementById('show_menu_flight_plan_buttons').innerHTML = svgShapeToSVG(ui['route'], '#ffffff', '#000000', mainButtonSize * globalScale);
	document.getElementById('show_menu_adsb_traffic').innerHTML = svgShapeToSVG(ui['wifi'], '#ffffff', '#000000', mainButtonSize * globalScale);
	document.getElementById('show_menu_nav_aids').innerHTML = svgShapeToSVG(ui['vor'], '#ffffff', '#000000', mainButtonSize * globalScale);
	document.getElementById('increase_ui_size').innerHTML = svgShapeToSVG(ui['plus'], '#ffffff', '#000000', mainButtonSize * globalScale);
	document.getElementById('reduce_ui_size').innerHTML = svgShapeToSVG(ui['minus'], '#ffffff', '#000000', mainButtonSize * globalScale);
	document.getElementById('back_button').innerHTML = svgShapeToSVG(ui['back_arrow'], '#ffffff', '#000000', mainButtonSize * globalScale);
}

function initOverlaySVGs() {
	ownshipSVG = 'data:image/svg+xml;utf8,' + encodeURIComponent(svgShapeToSVG(shapes['cessna'], (airborneCount == 0) ? greenColour : 'grey', '#000000', globalScale));
	compassSVG = 'data:image/svg+xml;utf8,' + encodeURIComponent(svgShapeToSVG(shapes['compass_rose'], '#000000', '#000000', globalScale));
	trackSVG = 'data:image/svg+xml;utf8,' + encodeURIComponent(svgShapeToSVG(shapes['track'], '#000000', '#ffffff', globalScale));
	trackBugSVG = 'data:image/svg+xml;utf8,' + encodeURIComponent(svgShapeToSVG(shapes['track_bug'], '#000000', '#ffffff', globalScale));
	trafficSVG = 'data:image/svg+xml;utf8,' + encodeURIComponent(svgShapeToSVG(shapes['traffic'], blueColour, '#000000', globalScale));
	highTrafficSVG = 'data:image/svg+xml;utf8,' + encodeURIComponent(svgShapeToSVG(shapes['traffic'], purpleColour, '#000000', globalScale));
	groundTrafficSVG = 'data:image/svg+xml;utf8,' + encodeURIComponent(svgShapeToSVG(shapes['traffic'], 'grey', '#000000', globalScale));
}

function initMap() {
	layersGroup = createBaseLayers();
	layers = layersGroup.getLayers();

	let routeLayer = new ol.layer.Vector({
		name: 'routeLayer',
		title: 'Route Layer',
		type: 'overlay',
		source: routeSource,
		updateWhileInteracting: true,
		updateWhileAnimating: true,
		zIndex: 150,
		declutter: false,
		renderBuffer: 60,
	});

	layers.push(routeLayer);

	ownshipLayer = new ol.layer.Vector({
		name: 'ownshipLayer',
		title: 'Ownship position',
		type: 'overlay',
		updateWhileInteracting: true,
		updateWhileAnimating: true,
		source: ownshipSource,
		zIndex: 200,
		declutter: false,
		renderBuffer: 60,
	});

	layers.push(ownshipLayer);

	trafficLayer = new ol.layer.Vector({
		name: 'trafficLayer',
		title: 'Traffic positions',
		type: 'overlay',
		updateWhileInteracting: true,
		updateWhileAnimating: true,
		source: trafficSource,
		zIndex: 250,
		declutter: false,
		renderBuffer: 60,
	});

	layers.push(trafficLayer);

		OLMap = new ol.Map({
		target: 'map_canvas',
		layers: layersGroup,
		view: new ol.View({
			center: ol.proj.fromLonLat([CenterLon, CenterLat]),
			zoom: zoomLvl,
			multiWorld: true,
		}),
		controls: [],
		interactions: new ol.interaction.defaults({
			altShiftDragRotate: false,
			pinchRotate: false,
			doubleClickZoom: false,
			dragPan: true,
			dragZoom: false
		}),
		maxTilesLoading: 4,
	});
}

function initTimers() {
	timers.clock = window.setInterval(updateClock, 500);
	updateClock();

	timers.navClock = window.setInterval(updateNavData, 1000);
	timers.adsbClock = window.setInterval(parseADSBTraffic, 1000);
}

function initEvents() {
	OLMap.on('contextmenu', function (evt) {
		evt.preventDefault();

		const id = getNextID();
		const closestPoint = findClosestPoint(evt.coordinate);
		let sector = new SectorObject(closestPoint[1]);

		if (closestPoint[0]) {
			sector.sectorName = closestPoint[0];
		}
		else {
			sector.sectorName = "WP" + id;
		}

		sector.id = id;

		if (route.length > 0) {
			sector.distance = route[route.length - 1].endPoint.distanceTo(sector.endPoint) * mToNm;
			sector.trueBearing = route[route.length - 1].endPoint.initialBearingTo(sector.endPoint);
			sector.midPoint = route[route.length - 1].endPoint.destinationPoint(sector.distance / (mToNm * 2), sector.trueBearing);
			sector.magBearing = normalizeAngle(sector.trueBearing - geoMag(route[route.length - 1].endPoint.lat, route[route.length - 1].endPoint.lon).dec)
			flightPlanValidated = false;
			fuelPlanValidated = false;
		}

		route.push(sector);

		updateRouteLayer();
		updateValidationUI();
	});

	OLMap.on('pointerdrag', function (evt) {
		if (!panMode) {
			panMode = true;
			jQuery('#center').css('display', 'flex');

			if (northUp) {
				jQuery('#north_up').css('display', 'none');
			}
		}
	});

	if (testMode) {
		OLMap.on('click', function (evt) {
			updateOwnship(ol.proj.toLonLat(evt.coordinate));

		});
	}

	addEventListener("fullscreenchange", (evt) => {
		if (!document.fullscreenElement) {
			jQuery('#toggle_fullscreen').text('Enter Fullscreen');
			jQuery('#toggle_fullscreen').css('background', '#0059b3');
			releaseWakeLock();
		}
	});

	addEventListener('error', function (evt) {
		log('Error: [' + evt.lineno + '] ' + evt.message);
	});

	if (simMode) {
		addEventListener("message", (event) => {
			if (event.origin !== "coui://html_ui") {
				return; // Ignore messages from unknown origins
			}

			updateOwnship(event.data);
		});
	}
}

function initButtons() {
	jQuery('#open_flight_plan').click(() => {
		openSideMenu("flight_plan");
	});
	jQuery('#open_fuel_plan').click(() => {
		openSideMenu("fuel_plan");
	});
	jQuery('#open_airport_info').click(() => {
		openSideMenu("airport_info");
	});
	jQuery('#show_log').click(() => {
		switchSideMenu("show_log");
	});
	jQuery('#open_menu').click(() => {
		openSideMenu(null);
	});
	jQuery('#close_menu').click(closeSideMenu);
	jQuery('#toggle_fullscreen').click(toggleFullScreen);
	jQuery('#toggle_snap').click(toggleSnap);
	jQuery('#remove_last_waypoint').click(removeLastWaypoint);
	jQuery('#load_flight_plan').click(() => {
		switchSideMenu("show_available_flight_plans");
	});
	jQuery('#save_flight_plan').click(() => {
		saveFlightPlanToServer(true);
	});
	jQuery('#reset_flight_plan').click(resetFlightPlan);
	jQuery('#clear_flight_plan').click(() => {
		clearFlightPlan(true);
	});
	jQuery('#calc_flight_plan').click(calculateFlightPlan);
	jQuery('#calc_fuel_plan').click(calculateFuelPlan);
	jQuery('#center').click(centerMap);
	jQuery('#north_up').click(toggleNorthUp);
	jQuery('#show_menu_setting_buttons').click(() => {
		switchSideMenu("show_menu_setting_buttons");
	});
	jQuery('#show_menu_flight_plan_buttons').click(() => {
		switchSideMenu("show_menu_flight_plan_buttons");
	});
	jQuery('#show_menu_nav_aids').click(() => {
		switchSideMenu("show_menu_nav_aids");
	});
	jQuery('#show_menu_adsb_traffic').click(() => {
		switchSideMenu("show_menu_adsb_traffic");
	});
	jQuery('#increase_ui_size').click(() => {
		setUIScale(true);
	});
	jQuery('#reduce_ui_size').click(() => {
		setUIScale(false);
	});
	jQuery('#back_button').click(() => {
		closeSideMenu();
		openSideMenu(null);
	});

	jQuery('.ui_button').css('background', blueColour);
	jQuery('.menu_button').css('background', blueColour);
	jQuery('#toggle_snap').css('background', greenColour);
	jQuery('#show_menu_setting_buttons').css('background', foregroundColour);
	jQuery('#show_menu_flight_plan_buttons').css('background', backgroundColour);
	jQuery('#show_menu_nav_aids').css('background', backgroundColour);
	jQuery('#show_menu_adsb_traffic').css('background', backgroundColour);
}

function updateClock() {
	date = new Date();
	jQuery("#clock").text(getTwoDigitText(date.getUTCHours()) + ":" + getTwoDigitText(date.getUTCMinutes()) + ":" + getTwoDigitText(date.getUTCSeconds()));
}
/*End of Initiate Section */

/*Map Layer Update Section*/
function updateRouteLayer() {
	let routeFeatures = [];

	const lineStyle = new ol.style.Style({
		stroke: new ol.style.Stroke({
			color: routeColor,
			width: routeWidth * globalScale,
		}),
		zIndex: 150,
	});

	const lineStyleActive = new ol.style.Style({
		fill: labelColor,
		stroke: new ol.style.Stroke({
			color: activeRouteColor,
			width: activeRouteWidth * globalScale,
		}),
		zIndex: 150,
	});

	for (let i = route.length - 1; i >= 0; --i) {
		const pointStyle = new ol.style.Style({
			text: new ol.style.Text({
				text: route[i].sectorName,
				fill: labelColor,
				backgroundFill: bgFill,
				textAlign: 'left',
				textBaseline: 'bottom',
				font: 'bold ' + (labelSize * globalScale) + 'em ' + labelFont,
				offsetX: 30 * globalScale,
				offsetY: 11 * globalScale,
				padding: [1 * globalScale, 8 * globalScale, -1 * globalScale, 10 * globalScale],
			}),
			image: new ol.style.Circle({
				radius: pointRadius * globalScale,
				fill: pointColor,
				stroke: new ol.style.Stroke({ color: 'white', width: pointStroke * globalScale }),
			}),
			zIndex: 150,
		});

		const pointFeatures = new ol.Feature(new ol.geom.Point(route[i].mapPoint));
		pointFeatures.setStyle(pointStyle);
		routeFeatures.push(pointFeatures);
	}

	let routePoints = [];
	let activeRoutePoints = [];
	let sections = null;
	let sectionDis = null;
	let point = null;

	if (route.length > 1) {
		for (let i = route.length - 1; i > 0; --i) {
			if (route[i].distance > 20) {
				sections = Math.ceil(route[i].distance / 20);
				sectionDis = route[i].distance / sections;

				for (let k = sections; k > 0; k--) {
					point = route[i-1].endPoint.destinationPoint(sectionDis * k / mToNm, route[i].trueBearing);
					(i == 1) ? activeRoutePoints.push(ol.proj.fromLonLat([point._lon, point._lat])) : routePoints.push(ol.proj.fromLonLat([point._lon, point._lat]));
				}
			}
			else {
				(i == 1) ? activeRoutePoints.push(route[i].mapPoint) : routePoints.push(route[i].mapPoint);
			}
		}

		activeRoutePoints.push(route[0].mapPoint);
		routePoints.push(route[1].mapPoint);

		const lineFeatures = new ol.Feature(new ol.geom.LineString(routePoints));
		lineFeatures.setStyle(lineStyle);
		routeFeatures.push(lineFeatures);

		const activeLineFeatures = new ol.Feature(new ol.geom.LineString(activeRoutePoints));
		activeLineFeatures.setStyle(lineStyleActive);
		routeFeatures.push(activeLineFeatures);
	}

	routeSource.clear();

	if (routeFeatures.length > 0) {
		routeSource.addFeatures(routeFeatures);
	}
}

function updateOwnshipLayer() {

	updateOverlayStyles();

	viewPoint.setCoordinates(ownship.mapPosition);
	ownshipIcon = new ol.Feature(viewPoint);
	ownshipIcon.setStyle(styleArrey);
	ownshipSource.clear();
	ownshipSource.addFeatures([ownshipIcon]);
}

function updateTrafficLayer(aircraft) {

	trafficSource.clear();

	let text = null;
	let alt = null;
	let iconSVG = null;

	for (let i = 0; i < aircraft.length; i++) {
		text = "";
		iconSVG = trafficSVG;

		if (aircraft[i].flight) text += aircraft[i].flight.trim();

		if (aircraft[i].alt_baro != 'ground') {
			if (text != "" && (aircraft[i].gs || aircraft[i].alt_baro)) text += "\n";
			if (aircraft[i].gs) text += Math.round(aircraft[i].gs) + " kts";

			if (aircraft[i].alt_baro) {
				alt = Number(aircraft[i].alt_baro);

				if (aircraft[i].baro_rate) {
					if (aircraft[i].baro_rate > 200) {
						text += ' ▲';
					}
					else if (aircraft[i].baro_rate < -200) {
						text += ' ▼';
					}
					else {
						text += '  ';
					}
				}
				else {
					text += '  ';
				}

				if (alt < 10000) {
					alt = (1 - Math.pow(Math.pow(1 - alt / 145366.45, 5.2553026) * 1013.25 / qnh, 0.190284)) * 145366.45;
					text += Math.round(alt);
				}
				else {
					text += ("FL" + aircraft[i].alt_baro).slice(0, 5);
					iconSVG = highTrafficSVG;
				}
			}
		}
		else {
			iconSVG = groundTrafficSVG;
		}

		if (text == "") text = "N/A";

		const trafficIconStyle = new ol.style.Style({
			image: new ol.style.Icon({
				src: iconSVG,
				rotateWithView: true,
				rotation: (aircraft[i].track) ? toRadians(aircraft[i].track) : 0,
				opacity: (aircraft[i].alt_baro && (alt >= 10000 || aircraft[i].alt_baro == 'ground')) ? 0.75 : 1,
			}),
			text: new ol.style.Text({
				text: text,
				fill: labelColor,
				backgroundFill: bgFill,
				textAlign: 'center',
				textBaseline: 'top',
				font: 'bold ' + (labelSize * globalScale * 0.75) + 'em ' + labelFont,
				offsetX: 0,
				offsetY: 25 * globalScale,
				padding: [1 * globalScale, 17 * globalScale, -1 * globalScale, 19 * globalScale],
			}),
			zIndex: 250,
		});

		if (!aircraft[i].lat && !aircraft[i].lon) continue;

		let trafficIcon = new ol.Feature(new ol.geom.Point(ol.proj.fromLonLat([aircraft[i].lon, aircraft[i].lat])));
		trafficIcon.setStyle(trafficIconStyle);
		trafficSource.addFeatures([trafficIcon]);
	}
}

function updateOverlayStyles() {
	styleArrey[1] = new ol.style.Style({
		image: new ol.style.Icon({
			src: ownshipSVG,
			rotateWithView: true,
			rotation: renderPars.radTrack,
		}),
		text: new ol.style.Text({
			text: getCardinalDirection(ownship.toGoDtk),
			fill: labelColor,
			backgroundFill: bgFill,
			textAlign: 'center',
			textBaseline: 'bottom',
			font: 'bold ' + (labelSize * globalScale * 0.75) + 'em ' + labelFont,
			offsetX: 0,
			offsetY: 50 * globalScale,
			padding: [1 * globalScale, 4 * globalScale, -1 * globalScale, 6 * globalScale],
		}),
		zIndex: 200,
	});

	styleArrey[2] = new ol.style.Style({
		image: new ol.style.Icon({
			src: trackBugSVG,
			rotateWithView: true,
			rotation: ((renderPars.radDtk) ? renderPars.radDtk : renderPars.radMagVar),
		}),
		zIndex: 195,
	});

	styleArrey[3] = new ol.style.Style({
		image: new ol.style.Icon({
			src: trackSVG,
			rotateWithView: true,
			rotation: renderPars.radTrack,
		}),
		zIndex: 200,
	});

	styleArrey[4] = new ol.style.Style({
		image: new ol.style.Icon({
			src: compassSVG,
			rotateWithView: true,
			rotation: renderPars.radMagVar,
		}),
		zIndex: 190,
	});
}
/*End of Map Layer Update Section*/

function updateNavData() {
	let totalDistance = 0;
	let eta = (airborneMode) ? [date.getUTCHours(), date.getUTCMinutes() + (date.getUTCSeconds() / 60)] : ownship.etd;
	let landingFuel = (fuelPlanValidated) ? ownship.totalFuel : null;

	jQuery('#landing_fuel').text('-.-');

	if (ownship.gpsAccuracy && ownship.gpsAccuracy > 10) {
		jQuery('#gps').css('display', 'flex');
		document.getElementById('gps').innerHTML = svgShapeToSVG(ui['satellite'], amberColour, '#ffffff', overlayButtonSize * globalScale);
	}
	else if (ownship.gpsAccuracy) {
		jQuery('#gps').css('display', 'none');
	}

	if ((route.length > 2 && airborneMode) || (route.length > 1 && !airborneMode)) {
		if (!flightPlanValidated) eta = [];

		const track = (airborneMode) ? ownship.toGoDtk : route[1].magBearing;
		const ete = (airborneMode) ? ownship.ete : route[1].ete;
		const routeFuel = (airborneMode) ? ownship.routeFuelReq : route[1].fuelRequired;
		totalDistance += (airborneMode) ? ownship.toGoDis : route[1].distance;

		if (flightPlanValidated) eta = addTime(eta, ete);
		if (fuelPlanValidated) landingFuel -= routeFuel;

		jQuery('#dis').text(getDecimalText(totalDistance));
		jQuery('#desired_trk').text(getThreeDigitText(track));
		jQuery('#wp_dis').text(route[1].sectorName);
		jQuery('#wp_ete').text(route[1].sectorName);

		for (let i = 2; i < route.length; ++i) {
			totalDistance += route[i].distance;
			if (flightPlanValidated) eta = addTime(eta, route[i].ete);
			if (fuelPlanValidated) landingFuel -= route[i].fuelRequired;
		}

		jQuery('#total_dis').text(getDecimalText(totalDistance));
		jQuery('#alt').text(getFourDigitText(route[1].altitude, false));
		jQuery('#eta').text(getTimeText(eta, false));
		if (landingFuel > 0) jQuery('#landing_fuel').text(getDecimalText(landingFuel));

		if (ete[1] < 1) {
			jQuery('#ete').text(getTwoDigitText(ete[1] * 60));
		}
		else {
			jQuery('#ete').text(getTimeText(ete, false));
		}
	}
	else if (route.length <= 2 && route.length > 0 && airborneMode) {
		let sector = 0;

		if (route.length == 2) sector = 1;

		jQuery('#dis').text(getDecimalText(ownship.toGoDis));
		jQuery('#total_dis').text(getDecimalText(ownship.toGoDis));
		jQuery('#desired_trk').text(getThreeDigitText(ownship.toGoDtk));
		jQuery('#wp_dis').text(route[sector].sectorName);
		jQuery('#wp_ete').text(route[sector].sectorName);
		jQuery('#eta').text(getTimeText(addTime(eta, ownship.ete), false));
		if (landingFuel > 0) jQuery('#landing_fuel').text(getDecimalText(landingFuel - ownship.routeFuelReq));

		if (ownship.ete[1] < 1) {
			jQuery('#ete').text(getTwoDigitText(ownship.ete[1] * 60));
		}
		else {
			jQuery('#ete').text(getTimeText(ownship.ete, false));
		}
	}
}

function getCardinalDirection(angle) {

	if (!angle || route.length == 0) return "-";

	let radial = normalizeAngle(Number(angle - 180));

	if (radial === 360) radial = 0;

	const index = Math.floor((radial + 22.5) / 45) % 8;

	return directions[index];
}

function toggleFullScreen() {
	if (!document.fullscreenElement) {
		if (document.documentElement.requestFullscreen) {
			document.documentElement.requestFullscreen();
		}
		else if (document.documentElement.mozRequestFullScreen) { /* Firefox */
			document.documentElement.mozRequestFullScreen();
		}
		else if (document.documentElement.webkitRequestFullscreen) { /* Safari */
			document.documentElement.webkitRequestFullscreen();
		} else if (document.documentElement.webkitRequestFullscreen) { /* Safari */
			document.documentElement.webkitRequestFullscreen();
		}
		else if (document.documentElement.msRequestFullscreen) { /* IE11 */
			document.documentElement.msRequestFullscreen();
		}

		jQuery('#toggle_fullscreen').css('background', greenColour);
		jQuery('#toggle_fullscreen').text('Exit Fullscreen');

		if ('wakeLock' in navigator) {
			requestWakeLock();
		}
	}
	else {
		if (document.exitFullscreen) {
			document.exitFullscreen();
		}
		else if (document.mozCancelFullScreen) {
			document.mozCancelFullScreen();
		}
		else if (document.webkitExitFullscreen) {
			document.webkitExitFullscreen();
		}
		else if (document.msExitFullscreen) {
			document.msExitFullscreen();
		}

		jQuery('#toggle_fullscreen').css('background', blueColour);
		jQuery('#toggle_fullscreen').text('Enter Fullscreen');

		releaseWakeLock();
	}
}

async function requestWakeLock() {
	try {
		wakeLock = await navigator.wakeLock.request();
	}
	catch (err) {
		log(err.name + ": " + err.message);
	}
}

function releaseWakeLock() {
	if (!wakeLock) {
		return;
	}
	try {
		wakeLock.release()
		wakeLock = null;
	}
	catch (err) {
		log(err.name + ": " + err.message);
	}
}

function openSideMenu(layout) {
	switch (layout) {
		case "flight_plan":
			jQuery('#menu_title').text('Flight Plan');
			jQuery('#flight_items').css('display', 'block');
			jQuery('#menu').css('width', '100%');

			generateFlightPlanTable();
			break;
		case "fuel_plan":
			jQuery('#menu_title').text('Fuel Plan');
			jQuery('#fuel_items').css('display', 'block');
			jQuery('#menu').css('width', '100%');

			generateFuelPlanTable();
			break;
		case "airport_info":
			jQuery('#menu_title').text('Airport Info');
			jQuery('#airport_items').css('display', 'block');
			jQuery('#menu').css('width', '100%');
			break;
		default:
			jQuery('#menu_title').text('Menu');
			jQuery('#menu_items').css('display', 'block');
			jQuery('#menu').css('width', '100%');
	}
}

async function switchSideMenu(layout) {
	switch (layout) {
		case "show_menu_setting_buttons":
			jQuery('#show_menu_setting_buttons').css('background', foregroundColour);
			jQuery('#show_menu_flight_plan_buttons').css('background', backgroundColour);
			jQuery('#show_menu_nav_aids').css('background', backgroundColour);
			jQuery('#show_menu_adsb_traffic').css('background', backgroundColour);
			jQuery('#menu_setting_buttons').css('display', 'block');
			jQuery('#menu_flight_plan_buttons').css('display', 'none');
			jQuery('#menu_nav_aids').css('display', 'none');
			jQuery('#menu_adsb_traffic').css('display', 'none');
			jQuery('#back_button').css('display', 'none');
			break;
		case "show_menu_flight_plan_buttons":
			jQuery('#show_menu_setting_buttons').css('background', backgroundColour);
			jQuery('#show_menu_flight_plan_buttons').css('background', foregroundColour);
			jQuery('#show_menu_nav_aids').css('background', backgroundColour);
			jQuery('#show_menu_adsb_traffic').css('background', backgroundColour);
			jQuery('#menu_setting_buttons').css('display', 'none');
			jQuery('#menu_flight_plan_buttons').css('display', 'block');
			jQuery('#menu_nav_aids').css('display', 'none');
			jQuery('#menu_adsb_traffic').css('display', 'none');
			jQuery('#back_button').css('display', 'none');
			break;
		case "show_menu_nav_aids":
			jQuery('#show_menu_setting_buttons').css('background', backgroundColour);
			jQuery('#show_menu_flight_plan_buttons').css('background', backgroundColour);
			jQuery('#show_menu_nav_aids').css('background', foregroundColour);
			jQuery('#show_menu_adsb_traffic').css('background', backgroundColour);
			jQuery('#menu_setting_buttons').css('display', 'none');
			jQuery('#menu_flight_plan_buttons').css('display', 'none');
			jQuery('#menu_nav_aids').css('display', 'block');
			jQuery('#menu_adsb_traffic').css('display', 'none');
			jQuery('#back_button').css('display', 'none');
			break;
		case "show_menu_adsb_traffic":
			jQuery('#show_menu_setting_buttons').css('background', backgroundColour);
			jQuery('#show_menu_flight_plan_buttons').css('background', backgroundColour);
			jQuery('#show_menu_nav_aids').css('background', backgroundColour);
			jQuery('#show_menu_adsb_traffic').css('background', foregroundColour);
			jQuery('#menu_setting_buttons').css('display', 'none');
			jQuery('#menu_flight_plan_buttons').css('display', 'none');
			jQuery('#menu_nav_aids').css('display', 'none');
			jQuery('#menu_adsb_traffic').css('display', 'block');
			jQuery('#back_button').css('display', 'none');
			break;
		case "show_log":
			jQuery('#menu_title').text('Error Log');
			jQuery('#log_items').css('display', 'block');
			jQuery('#back_button').css('display', 'block');
			jQuery('#menu').css('width', '100%');
			jQuery('#menu_items').css('display', 'none');
			break;
		case "show_available_flight_plans":
			jQuery('#menu_title').text('Available Flight Plans');
			jQuery('#available_fp_items').css('display', 'block');
			jQuery('#back_button').css('display', 'block');
			jQuery('#menu_items').css('display', 'none');

			let jsonFiles = await getJsonFilesList();

			let newBody = document.createElement('div');
			let htmlBody = document.getElementById('available_fp_items');
			htmlBody.innerHTML = "";

			if (jsonFiles) {
				for (let i = 0; i < jsonFiles.length; i++) {
					const newButton = document.createElement('button');
					newButton.innerText = jsonFiles[i];
					newButton.id = jsonFiles[i];
					newButton.className = "menu_button";
					newButton.style = "background: " + blueColour;
					newButton.addEventListener('click', () => {
						loadFlightPlanFromServer(jsonFiles[i]);
					});
					newBody.appendChild(newButton);
				}
			}
			else {
				newBody.innerHTML = "No flight plans available.";
			}

			htmlBody.appendChild(newBody);
			break;
		default:
			break;
	}
}

function closeSideMenu() {
	jQuery('#menu_items').css('display', 'none');
	jQuery('#flight_items').css('display', 'none');
	jQuery('#fuel_items').css('display', 'none');
	jQuery('#traffic_items').css('display', 'none');
	jQuery('#log_items').css('display', 'none');
	jQuery('#available_fp_items').css('display', 'none');
	jQuery('#back_button').css('display', 'none');
	jQuery('#menu').css('width', '0');
	jQuery('#menu_title').text('');
}

function toggleSnap() {
	if (!snap) {
		jQuery('#toggle_snap').css('background', greenColour);
		jQuery('#toggle_snap').text('Waypoint Snap: On');
		snap = true;
	}
	else {
		jQuery('#toggle_snap').css('background', blueColour);
		jQuery('#toggle_snap').text('Waypoint Snap: Off');
		snap = false;
	}
}

function resetUI() {
	jQuery('#dis').text('-.-');
	jQuery('#desired_trk').text('---');
	jQuery('#wp_dis').text('WP');
	jQuery('#wp_ete').text('WP');
	jQuery('#ete').text('--:--');
	jQuery('#alt').text('----');
	jQuery('#total_dis').text('-.-');
	jQuery('#eta').text('--:--');
	jQuery('#landing_fuel').text('-.-');
}

function removeLastWaypoint() {
	if (route.length > 0) {
		route[route.length - 1].setNull();
		route.pop();
		updateRouteLayer();
		generateFlightPlanTable();
		generateFuelPlanTable();
		calculateFlightPlan();
		calculateFuelPlan();
		closeSideMenu();
	}
}

function clearFlightPlan(fullClear) {
	resetUI();

	for (let i = 0; i < route.length; ++i) {
		route[i].setNull();
	}

	for (let i = 0; i < completedRoute.length; ++i) {
		completedRoute[i].setNull();
	}
	route = [];
	completedRoute = [];
	ownship.atd = null;
	ownship.etd = [];

	if (fullClear) {
		updateRouteLayer();
		updateValidationUI();
		closeSideMenu();

		localStorage.removeItem("currentFlightPlan");
	}
}

function resetFlightPlan() {
	for (let i = completedRoute.length - 1; i >= 0; --i) {
		let sector = new SectorObject(completedRoute[i].mapPoint);
		sector.clone(completedRoute[i]);
		route.unshift(sector);
		completedRoute[i].setNull();
	}

	completedRoute = [];
	ownship.atd = null;

	jQuery('#atd').css('display', 'none');
	jQuery('#etd_input').css('display', 'inline-block');

	updateRouteLayer();
	updateValidationUI();
	closeSideMenu();
}

function removeFirstWaypoint() {
	if (route.length > 1) {
		let sector = new SectorObject(route[0].mapPoint);
		sector.clone(route[0]);
		completedRoute.push(sector);
		route[0].setNull();
		route.shift();
		updateRouteLayer();
		updateValidationUI();
		saveFlightPlanToServer(false);
	}
}

function findClosestPoint(mapLatLong) {
	if (!snap) return [null, mapLatLong];

	const longlat = ol.proj.toLonLat(mapLatLong);
	const point = new geodesy.LatLon(longlat[1], longlat[0]);
	let point2 = new geodesy.LatLon(0,0);

	if (airpotList) {
		for (let i = 0; i < airpotList.length; i++) {
			point2.lat = airpotList[i].geometry.coordinates[1];
			point2.lon = airpotList[i].geometry.coordinates[0];

			if (point.distanceTo(point2) * mToNm < 2) {
				return [airpotList[i].icaoCode, ol.proj.fromLonLat(airpotList[i].geometry.coordinates)];
			}
		}
	}

	return [null, mapLatLong];
}

function generateFlightPlanTable() {
	jQuery('#departure').text('N/A');
	jQuery('#destination').text('N/A');

	if (ownship.atd) {
		jQuery('#atd').css('display', 'inline-block');
		jQuery('#atd').text(getTimeText(ownship.atd, false) + ' z');
		jQuery('#etd_input').css('display', 'none');
	}

	let newBody = document.createElement('tbody');
	let htmlTable = document.getElementById('flight_table');
	let tbody = htmlTable.tBodies[0];
	let eta = [];

	if (route.length > 0) {
		jQuery('#departure').text((completedRoute.length > 0) ? completedRoute[0].sectorName : route[0].sectorName);
		jQuery('#destination').text(route[route.length - 1].sectorName);
	}

	if (route.length > 1) {
		let totalDistance = 0;
		let course = null;
		let windDir = null;
		let windSpd = null;
		let heading = null;
		let groundSpeed = null;
		let distance = null;
		let ete = null;
		let newRow = null;
		let rowConstruct = null;

		for (let i = 1; i < route.length; ++i) {
			newRow = document.createElement('tr');
			if (i == 1) newRow.id = "activeRow";
			totalDistance += route[i].distance;

			if (flightPlanValidated) {
				if (eta.length != 2 && !airborneMode) {
					eta = addTime(ownship.etd, route[i].ete);
				}
				else if (eta.length != 2) {
					eta = addTime([date.getUTCHours(), date.getUTCMinutes() + (date.getUTCSeconds() / 60)], ownship.ete);
				}
				else {
					eta = addTime(route[i].ete, eta);
				}
			}

			course = '<td class="mid_font">' + getThreeDigitText(route[i].magBearing) + '</td>';
			windDir = '<td><input type="number"  class="mid_font" id="' + route[i].id + '_wind_dir" value="' + getThreeDigitText(route[i].windDir) + '" min="1" max="360"></td>';
			windSpd = '<td><input type="number"  class="mid_font" id="' + route[i].id + '_wind_spd" value="' + getRoundText(route[i].windSpd) + '" min="0"></td>';
			heading = '<td class="mid_font">' + getThreeDigitText(route[i].heading) + '</td>';
			groundSpeed = '<td class="mid_font">' + getRoundText(route[i].groundSpeed) + '</td>';
			distance = '<td class="mid_font">' + getDecimalText(route[i].distance) + '</td>';
			ete = '<td class="mid_font">' + getTimeText(route[i].ete, true) + '</td>';

			if (i == 1 && airborneMode) {
				totalDistance = ownship.toGoDis;

				course = '<td class="mid_font">' + getThreeDigitText(ownship.toGoDtk) + '</td>';
				windDir = '<td class="mid_font" id="' + route[i].id + '_wind_dir">' + getThreeDigitText(route[i].windDir) + '</td>';
				windSpd = '<td class="mid_font" id="' + route[i].id + '_wind_spd">' + getRoundText(route[i].windSpd) + '</td>';
				heading = '<td><input type="number"  class="mid_font" id="' + route[i].id + '_hdg" value="' + getThreeDigitText(route[i].heading) + '" min="1" max="360"></td>';
				groundSpeed = '<td class="mid_font">' + getRoundText(ownship.toGs) + '</td>';
				distance = '<td class="mid_font">' + getDecimalText(ownship.toGoDis) + '</td>';
				ete = '<td class="mid_font">' + getTimeText(ownship.ete, true) + '</td>';
			}

			rowConstruct = '<td class="mid_font">' + route[i].sectorName + '</td>';
			rowConstruct += '<td><input type="number"  class="mid_font" id="' + route[i].id + '_alt" value="' + getFourDigitText(route[i].altitude, true) + '" step="100" min="0"></td>';
			rowConstruct += '<td><input type="number"  class="mid_font" id="' + route[i].id + '_ias" value="' + getRoundText(route[i].ias) + '" min="0"></td>';
			rowConstruct += course;
			rowConstruct += windDir;
			rowConstruct += windSpd;
			rowConstruct += heading;
			rowConstruct += groundSpeed;
			rowConstruct += distance;
			rowConstruct += '<td class="mid_font">' + getDecimalText(totalDistance) + '</td>';
			rowConstruct += ete;
			rowConstruct += '<td class="mid_font">' + getTimeText(eta, true) + '</td>';
			newRow.innerHTML = rowConstruct;
			newBody.appendChild(newRow);
		}
	}

	htmlTable.replaceChild(newBody, tbody);
	tbody.remove();

	if (airborneMode) jQuery('#activeRow').css('background', darkGreenColour);
	jQuery('#fp_eta').text(getTimeText(eta, false));
}

function calculateFlightPlan() {
	let table_alt = null;
	let table_ias = null;
	let table_wind_dir = null;
	let table_wind_spd = null;
	let table_heading = null;

	flightPlanValidated = true;

	ownship.etd = [Number(document.getElementById('etd_hours').value), Number(document.getElementById('etd_minutes').value)];

	for (let i = 1; i < route.length; ++i) {
		table_alt = document.getElementById(route[i].id + '_alt').value;
		table_ias = document.getElementById(route[i].id + '_ias').value;

		route[i].altitude = (table_alt == "") ? null : Number(table_alt);
		route[i].ias = (table_ias == "") ? null : Number(table_ias);

		if (i == 1 && airborneMode) {
			table_heading = document.getElementById(route[i].id + '_hdg').value;
			route[i].heading = (table_heading == "") ? null : Number(table_heading);
			route[i].calculateWind(ownship.toGoDtk, ownship.toGs);
		}
		else {
			table_wind_dir = document.getElementById(route[i].id + '_wind_dir').value;
			table_wind_spd = document.getElementById(route[i].id + '_wind_spd').value;

			route[i].windDir = (table_wind_dir == "") ? null : Number(table_wind_dir);
			route[i].windSpd = (table_wind_spd == "") ? null : Number(table_wind_spd);
			route[i].calculateWindCorrection();
		}

		if (table_alt == "" || table_ias == "" || table_wind_dir == "" || table_wind_spd == "") {
			flightPlanValidated = false;
		}
	}

	generateFlightPlanTable();
	updateValidationUI();
}

function generateFuelPlanTable() {
	let newBody = document.createElement('tbody');
	let htmlTable = document.getElementById('fuel_table');
	let tbody = htmlTable.tBodies[0];
	let requiredFuel = null;

	jQuery('#total_fuel').prop("value", getDecimalText(ownship.totalFuel));

	if (route.length > 1) {
		let totalFuelRemaining = ownship.totalFuel;
		let ete = null;
		let fuelRequiredField = null;
		let newRow = null;
		let rowConstruct = null;
		requiredFuel = 0;

		for (let i = 1; i < route.length; ++i) {
			newRow = document.createElement('tr');
			if (i == 1) newRow.id = "activeRowFuel";

			ete = '<td class="mid_font">' + getTimeText(route[i].ete, true) + '</td>';
			fuelRequiredField = '<td class="mid_font">' + getDecimalText(route[i].fuelRequired) + '</td>';

			if (i == 1 && airborneMode) {
				ete = '<td class="mid_font">' + getTimeText(ownship.ete, true) + '</td>';
				fuelRequiredField = '<td class="mid_font">' + getDecimalText(ownship.routeFuelReq) + '</td>';
				totalFuelRemaining -= ownship.routeFuelReq;
				requiredFuel += ownship.routeFuelReq;
			}
			else {
				totalFuelRemaining -= route[i].fuelRequired;
				requiredFuel += route[i].fuelRequired;
			}

			rowConstruct = '<td class="mid_font">' + route[i].sectorName + '</td>';
			rowConstruct += '<td class="mid_font">' + getFourDigitText(route[i].altitude, true) + '</td>';
			rowConstruct += '<td><input type="number"  class="mid_font" id="' + route[i].id + '_fuel_flow" value="' + getDecimalText(route[i].fuelFlow) + '" step="0.1" min="0"></td>';
			rowConstruct += ete;
			rowConstruct += fuelRequiredField;
			rowConstruct += '<td class="mid_font">' + getDecimalText(totalFuelRemaining) + '</td>';
			newRow.innerHTML = rowConstruct;
			newBody.appendChild(newRow);
		}

		if (ownship.holdFuel) {
			totalFuelRemaining -= ownship.holdFuel;
			requiredFuel += ownship.holdFuel;
		}

		newRow = document.createElement('tr');
		rowConstruct = '<td class="mid_font">Hold Fuel</td>';
		rowConstruct += '<td class="mid_font">-</td>';
		rowConstruct += '<td><input type="number"  class="mid_font" id="hold_fuel_flow" value="' + getDecimalText(ownship.holdFuelFlow) + '" step="0.1" min="0"></td>';
		rowConstruct += '<td><input type="number"  class="mid_font" id="hold_duration" value="' + getTwoDigitText(ownship.holdDuration) + '" step="1" min="1"></td>';
		rowConstruct += '<td class="mid_font">' + getDecimalText(ownship.holdFuel) + '</td>';
		rowConstruct += '<td class="mid_font">' + getDecimalText(totalFuelRemaining) + '</td>';
		newRow.innerHTML = rowConstruct;
		newBody.appendChild(newRow);

		if (ownship.reserveFuel) {

			totalFuelRemaining -= ownship.reserveFuel;
			requiredFuel += ownship.reserveFuel;
		}

		newRow = document.createElement('tr');
		rowConstruct = '<td class="mid_font">Reserve Fuel</td>';
		rowConstruct += '<td class="mid_font">-</td>';
		rowConstruct += '<td><input type="number"  class="mid_font" id="reserve_fuel_flow" value="' + getDecimalText(ownship.reserveFuelFlow) + '" step="0.1" min="0"></td>';
		rowConstruct += '<td><input type="number"  class="mid_font" id="reserve_duration" value="' + getTwoDigitText(ownship.reserveDuration) + '" step="1" min="0"></td>';
		rowConstruct += '<td class="mid_font">' + getDecimalText(ownship.reserveFuel) + '</td>';
		rowConstruct += '<td class="mid_font">' + getDecimalText(totalFuelRemaining) + '</td>';
		newRow.innerHTML = rowConstruct;
		newBody.appendChild(newRow);

	}

	if (fuelPlanValidated && requiredFuel) {
		jQuery('#required_fuel').text(getDecimalText(requiredFuel));
	}
	else {
		jQuery('#required_fuel').text('-.-');
	}

	htmlTable.replaceChild(newBody, tbody);
	tbody.remove();

	if (airborneMode) jQuery('#activeRowFuel').css('background', darkGreenColour);
}

function calculateFuelPlan() {
	let table_fuel_flow = null;

	fuelPlanValidated = true;

	ownship.totalFuel = Number(document.getElementById('total_fuel').value);

	if (route.length > 1) {
		ownship.holdFuelFlow = Number(document.getElementById('hold_fuel_flow').value);
		ownship.holdDuration = Number(document.getElementById('hold_duration').value);
		ownship.reserveFuelFlow = Number(document.getElementById('reserve_fuel_flow').value);
		ownship.reserveDuration = Number(document.getElementById('reserve_duration').value);

		ownship.reserveFuel = ownship.reserveFuelFlow * ownship.reserveDuration / 60;
		ownship.holdFuel = ownship.holdFuelFlow * ownship.holdDuration / 60;
	}

	for (let i = 1; i < route.length; ++i) {
		table_fuel_flow = document.getElementById(route[i].id + '_fuel_flow').value;
		route[i].fuelFlow = (table_fuel_flow == "") ? null : Number(table_fuel_flow);

		if (route[i].fuelFlow == null || (!airborneMode && route[i].ete.length == 0)) fuelPlanValidated = false;

		if (i == 1 && airborneMode) ownship.routeFuelReq = route[i].fuelFlow * (ownship.ete[0] + (ownship.ete[1] / 60));

		if (route[i].ete.length != 0) route[i].fuelRequired = (route[i].ete[0] + (route[i].ete[1] / 60)) * route[i].fuelFlow;
	}

	if (!ownship.reserveFuel || ownship.reserveFuel == 0) fuelPlanValidated = false;

	generateFuelPlanTable();
	updateValidationUI();
}

function updateValidationUI() {
	let flightPlanColour = (flightPlanValidated) ? greenColour : amberColour;
	let fuelPlanColour = (fuelPlanValidated) ? greenColour : amberColour;

	if (route.length < 2) {
		flightPlanColour = blueColour;
		fuelPlanColour = blueColour;
	}

	jQuery('#open_flight_plan').css('background', flightPlanColour);
	jQuery('#open_fuel_plan').css('background', fuelPlanColour);
}

function getTwoDigitText(value) {
	return (value == null) ? "" : ('0' + Math.round(value)).slice(-2);
}

function getThreeDigitText(value) {
	if (value == null) return "";

	let val = ('00' + Math.round(value)).slice(-3);

	return (val == "000") ? "360" : val;
}

function getFourDigitText(value, nullString) {
	if (value == null && nullString) {
		return "";
	}
	else if (value == null) {
		return "----";
	}

	return ('000' + Math.round(value)).slice(-4);
}

function getTimeText(value, nullString) {
	if (value.length == 0 && nullString) {
		return "";
	}
	else if (value.length == 0) {
		return "--:--";
	}

	return ('0' + value[0]).slice(-2) + ":" + ('0' + Math.floor(value[1])).slice(-2);
}

function getRoundText(value) {
	return (value == null || isNaN(value)) ? "" : Math.round(value);
}

function getDecimalText(value) {
	return (value == null) ? "" : (Math.round(value * 10) / 10).toFixed(1);
}

function toggleNorthUp() {
	northUp = !northUp;

	if (northUp) {
		document.getElementById('north_up').innerHTML = svgShapeToSVG(ui['compass'], '#ffffff', '#000000', overlayButtonSize * globalScale);
		jQuery('#north_up svg').css('transform', 'rotate(-45deg)');
		animateView(500);
	}
	else {
		document.getElementById('north_up').innerHTML = svgShapeToSVG(ui['plane'], '#ffffff', '#000000', overlayButtonSize * globalScale);
		animateView(500);
	}

	if (ownship.track && panMode && northUp) {
		OLMap.getView().setRotation(0);
		jQuery('#north_up').css('display', 'none');
	}
}

function updateOwnship(position) {
	if (position.coords != null) {
		ownship.position.lat = position.coords.latitude;
		ownship.position.lon = position.coords.longitude;
	}
	else {
		ownship.position.lat = position[1];
		ownship.position.lon = position[0];
	}

	let localDate = new Date();
	ownship.fixTime = localDate.getTime();

	if (!firstPosition) {
		let deltaTime = ownship.fixTime - ownship.lastFixTime;
		ownship.gs = ownship.lastPosition.distanceTo(ownship.position) * mToNm * 3600000 / deltaTime;
		ownship.track = ownship.lastPosition.initialBearingTo(ownship.position);
		ownship.magVar = geoMag(ownship.position.lat, ownship.position.lon).dec;
		ownship.mapPosition = ol.proj.fromLonLat([ownship.position.lon, ownship.position.lat]);

		speedSamples[speedSamples.length] = ownship.gs;

		if (speedSamples.length > 30) speedSamples.shift();

		if (position.coords) ownship.gpsAccuracy = position.coords.accuracy;

		if (airborneCount == 0 && !airborneMode) {
			panMode = false;
			northUp = false;
			airborneMode = true;

			jQuery('#north_up').css('display', 'flex');
			initOverlaySVGs();
			centerMap();
		}

		if (ownship.gs > 30 && airborneCount > 0) {
			airborneCount--;
		}

		jQuery('#gs').text(getRoundText(ownship.gs));
		jQuery('#trk').text(getThreeDigitText(normalizeAngle(ownship.track - ownship.magVar)));

		if (airborneMode && !ownship.atd) {
			ownship.atd = [localDate.getUTCHours(), localDate.getUTCMinutes() + (localDate.getUTCSeconds() / 60)];
		}

		if (airborneMode && route.length > 0) {
			let point = (route.length == 1) ? 0 : 1;

			ownship.toGoDis = ownship.position.distanceTo(route[point].endPoint) * mToNm;
			ownship.toGoDtk = normalizeAngle(ownship.position.initialBearingTo(route[point].endPoint) - ownship.magVar);

			averageSpeed = 0;

			for (let i = 0; i < speedSamples.length; i++) {
				averageSpeed += speedSamples[i];
			}

			averageSpeed = averageSpeed / speedSamples.length;

			ownship.toGs = Math.max(10, averageSpeed * Math.cos(toRadians(ownship.track - ownship.magVar - ownship.toGoDtk)));

			getClosingTime();

			if (route[point].fuelFlow) {
				ownship.routeFuelReq = route[point].fuelFlow * (ownship.ete[0] + (ownship.ete[1] / 60));
				ownship.totalFuel -= route[point].fuelFlow * deltaTime / 3600000;
			}

			const headingDiff = Math.abs(ownship.toGoDtk - (ownship.track - ownship.magVar)) % 360;

			if (((headingDiff > 180) ? 360 - headingDiff : headingDiff) < 90 && !canRemoveWaypoint) {
				canRemoveWaypoint = true;
			}

			if (ownship.toGoDis < 0.1 || (ownship.toGoDis < 3.0 && ((headingDiff > 180) ? 360 - headingDiff : headingDiff) > 90 && canRemoveWaypoint)) {
				removeFirstWaypoint();
				canRemoveWaypoint = false;
			}

			ownship.prevToGoDis = ownship.toGoDis;
		}

		renderPars.radTrack = toRadians(ownship.track);
		renderPars.radMagVar = toRadians(ownship.magVar);
		renderPars.radDtk = (ownship.toGoDtk && route.length > 0) ? renderPars.radMagVar + toRadians(ownship.toGoDtk) : null;

		if (!panMode) {
			animateView(deltaTime);
		}

		updateOwnshipLayer();
	}

	ownship.lastPosition.lat = ownship.position.lat;
	ownship.lastPosition.lon = ownship.position.lon;
	ownship.lastFixTime = ownship.fixTime;

	if(firstPosition) firstPosition = false;
}

function gpsError(error) {
	navigator.geolocation.clearWatch(gpsWatchID);
	log('Warning: ' + error.message);
	jQuery('#gps').css('display', 'flex');
	document.getElementById('gps').innerHTML = svgShapeToSVG(ui['satellite'], redColour, '#ffffff', overlayButtonSize * globalScale);
	ownship.gpsAccuracy = null;
}

function centerMap() {
	if (airborneMode) {
		panMode = false;
		jQuery('#center').css('display', 'none');
		jQuery('#north_up').css('display', 'flex');
	}

	animateView(500);
}

function getClosingTime() {
	if (!ownship.toGoDtk && !ownship.toGoDis && !ownship.track) {
		ownship.ete = [];
		return;
	}

	const hours = ownship.toGoDis / ownship.toGs;

	ownship.ete = [Math.floor(hours), (hours - Math.floor(hours)) * 60];
}

function addTime(time1, time2) {
	let minutes = time1[1] + time2[1];
	let hours = Math.floor(minutes / 60);

	minutes -= hours * 60;
	hours += time1[0] + time2[0];

	return [hours % 24, minutes];
}

function log(string) {
	let log = document.getElementById('log_items');
	let entry = document.createElement('div');
	entry.innerHTML = string;
	log.prepend(entry);
}

function animateView(duration) {
	if (!firstPosition && !ownship.track) return;

	OLMap.getView().cancelAnimations();
	OLMap.getView().animate(
		{
			center: ownship.mapPosition,
			rotation: (northUp) ? 0 : -renderPars.radTrack,
			duration: duration,
		},
	);
}

function getNextID() {
	let id = -1;

	for (let i = 0; i < route.length; ++i) {
		if (route[i].id > id) id = route[i].id;
	}

	return id + 1;
}

async function saveFlightPlanToServer(menuSave) {
	try {
		let fileName = null;

		if (menuSave) {
			for (let i = 0; i < route.length; i++) {
				if (i == 0) {
					fileName = route[i].sectorName;
				}
				else {
					fileName += "-" + route[i].sectorName;
				}
			}
		}
		else {
			fileName = localStorage.getItem("currentFlightPlan");
		}

		if (!fileName) return;

		const response = await fetch(apiData + '?filename=' + fileName, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ ownship, route, completedRoute }),
		});

		if (response.ok) {
			localStorage.setItem("currentFlightPlan", fileName);
		}
		else {
			log('Error saving data: ' + response.statusText);
		}
	}
	catch (err) {
		log('Error during fetch: ' + err.message);
	}

	if (menuSave) closeSideMenu();
}

async function loadFlightPlanFromServer(fileName) {
	try {
		const response = await fetch(apiData + '?filename=flight_plans/' + fileName);

		if (response.ok) {
			clearFlightPlan(false);

			const result = await response.json(); // Parse JSON response

			if(result.ownship)
			{
				ownship.atd = result.ownship.atd;
				ownship.etd = result.ownship.etd;
				ownship.totalFuel = result.ownship.totalFuel ;
				ownship.routeFuelReq = result.ownship.routeFuelReq;
				ownship.reserveFuel = result.ownship.reserveFuel;
				ownship.reserveFuelFlow = result.ownship.reserveFuelFlow;
				ownship.reserveDuration = result.ownship.reserveDuration;
				ownship.holdFuel = result.ownship.holdFuel;
				ownship.holdFuelFlow = result.ownship.holdFuelFlow;
				ownship.holdDuration = result.ownship.holdDuration;
			}

			if (result.route) {
				for (let i = 0; i < result.route.length; ++i) {
					let newSector = new SectorObject(result.route[i].mapPoint);
					newSector.clone(result.route[i]);
					route.push(newSector);
				}
			}

			if (result.completedRoute) {
				for (let i = 0; i < result.completedRoute.length; ++i) {
					let newSector = new SectorObject(result.completedRoute[i].mapPoint);
					newSector.clone(result.completedRoute[i]);
					completedRoute.push(newSector);
				}
			}

			generateFlightPlanTable();
			generateFuelPlanTable();
			calculateFlightPlan();
			calculateFuelPlan();
			updateRouteLayer();

			localStorage.setItem("currentFlightPlan", fileName);
		}
		else {
			log('Error loading data: ' + response.statusText);
		}
	}
	catch (err) {
		log('Error during fetch: ' + err.message);
	}

	closeSideMenu();
}

async function getJsonFilesList() {
	try {
		const response = await fetch(apiData);

		if (response.ok) {
			return await response.json(); // Parse JSON response
		}
		else {
			log('Error loading data: ' + response.statusText);
			return null;
		}
	}
	catch (err) {
		log('Error during fetch: ' + err.message);
		return null;
	}
}

async function loadAirportsFromServer() {
	try {
		const response = await fetch(apiData + '?filename=nav/au_apt');

		if (response.ok) {
			airpotList = await response.json(); // Parse JSON response
		}
		else {
			log('Error loading data: ' + response.statusText);
		}
	}
	catch (err) {
		log('Error during fetch: ' + err.message);
	}
}

function setUIScale(increase) {
	if (increase) {
		globalScale += 0.1;
	}
	else if (globalScale > 0.5) {
		globalScale -= 0.1;
	}

	document.documentElement.style.setProperty("--SCALE", globalScale);
	localStorage.setItem("globalScale", globalScale);

	styleArrey[0] = new ol.style.Style({
		image: new ol.style.Circle({
			radius: 153 * globalScale,
			stroke: new ol.style.Stroke({ color: [255, 255, 255, 0.8], width: 32 * globalScale }),
		}),
		zIndex: 180,
	});

	initIcons();
	initOverlaySVGs();
	updateRouteLayer();
	jQuery('#zoom').text(getDecimalText(globalScale));
}

async function parseADSBTraffic() {
	try {
		const response = await fetch(apiData + '?filename=aircraft');

		if (response.ok) {
			const result = await response.json(); // Parse JSON response

			if (result.aircraft) {
				updateTrafficLayer(result.aircraft);
			}
		}
		else {
			log('Error loading data: ' + response.statusText);
			trafficSource.clear();
		}
	}
	catch (err) {
		log('Error during fetch: ' + err.message);
	}
}

initialize();