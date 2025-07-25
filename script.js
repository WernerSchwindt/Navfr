"use strict";

let date = null;
let layers = null;
let layersGroup = null;
let OLMap = null;
let timers = {};
let iconLayer = null;
let ownshipLayer = null;
let routeSource = new ol.source.Vector();
let ownshipSource = new ol.source.Vector();
let route = [];
let completedRoute = [];
let geoMag = null;
let currZoom = null;
let snap = true;
let flightPlanValidated = null;
let fuelPlanValidated = null;
let departure = null;
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

let testMode = false;
let simMode = false;

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

let ownshipIcon = null;

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

	geoMag = geoMagFactory(cof2Obj());

	ownship.position = null;
	ownship.mapPosition = null;
	ownship.fixTime = null;
	ownship.lastPosition = null;
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
		zIndex: 189,
	});

	compassSVG = 'data:image/svg+xml;utf8,' + escape(svgShapeToSVG(shapes['compass_rose'], '#000000', '#000000', globalScale));
	trackSVG = 'data:image/svg+xml;utf8,' + escape(svgShapeToSVG(shapes['track'], '#000000', '#ffffff', globalScale));
	trackBugSVG = 'data:image/svg+xml;utf8,' + escape(svgShapeToSVG(shapes['track_bug'], '#000000', '#ffffff', globalScale));

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

function initIcons() {
	document.getElementById('center').innerHTML = svgShapeToSVG(ui['center'], '#ffffff', '#000000', overlayButtonSize * globalScale);
	document.getElementById('north_up').innerHTML = svgShapeToSVG(ui['plane'], '#ffffff', '#000000', overlayButtonSize * globalScale);
	document.getElementById('maps').innerHTML = svgShapeToSVG(ui['map'], '#ffffff', '#000000', overlayButtonSize * globalScale);
	document.getElementById('open_fuel_plan').innerHTML = svgShapeToSVG(ui['fuel'], '#ffffff', '#000000', mainButtonSize * globalScale);
	document.getElementById('open_flight_plan').innerHTML = svgShapeToSVG(ui['takeoff'], '#ffffff', '#000000', mainButtonSize * globalScale);
	document.getElementById('direct_to').innerHTML = svgShapeToSVG(ui['direct'], '#ffffff', '#000000', mainButtonSize * globalScale);
	document.getElementById('open_traffic').innerHTML = svgShapeToSVG(ui['wifi'], '#ffffff', '#000000', mainButtonSize * globalScale);
	document.getElementById('open_menu').innerHTML = svgShapeToSVG(ui['bars'], '#ffffff', '#000000', mainButtonSize * globalScale);
	document.getElementById('close_menu').innerHTML = svgShapeToSVG(ui['cross'], '#ffffff', '#000000', mainButtonSize * globalScale);
	document.getElementById('show_menu_setting_buttons').innerHTML = svgShapeToSVG(ui['gear'], '#ffffff', '#000000', mainButtonSize * globalScale);
	document.getElementById('show_menu_flight_plan_buttons').innerHTML = svgShapeToSVG(ui['route'], '#ffffff', '#000000', mainButtonSize * globalScale);
	document.getElementById('increase_ui_size').innerHTML = svgShapeToSVG(ui['plus'], '#ffffff', '#000000', mainButtonSize * globalScale);
	document.getElementById('reduce_ui_size').innerHTML = svgShapeToSVG(ui['minus'], '#ffffff', '#000000', mainButtonSize * globalScale);
	document.getElementById('back_button').innerHTML = svgShapeToSVG(ui['back_arrow'], '#ffffff', '#000000', mainButtonSize * globalScale);
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

	/*iconLayer = new ol.layer.Vector({
		name: 'iconLayer',
		type: 'overlay',
		title: 'Aircraft positions',
		source: PlaneIconFeatures,
		declutter: false,
		zIndex: 200,
		renderBuffer: renderBuffer,
	});
	
	layers.push(iconLayer);*/

	layers.push(ownshipLayer);

	ol_map_init();
}

function ol_map_init() {
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

	/*OLMap.addControl(new ol.control.LayerSwitcher({
		groupSelectStyle: 'none',
		activationMode: 'click', 
		target: 'map_canvas',
	}));*/
}

function initTimers() {
	timers.clock = window.setInterval(updateClock, 500);
	updateClock();

	timers.navClock = window.setInterval(updateNavData, 1000);
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
			sector.distance = greatCircleDistance(route[route.length - 1].latlong, sector.latlong);
			sector.bearing = (calculateBearing(route[route.length - 1].latlong, sector.latlong) - getMagVar(route[route.length - 1].latlong, sector.latlong, true)) % 360;
			flightPlanValidated = false;
			fuelPlanValidated = false;
		}

		if (route.length == 0) {
			departure = sector.sectorName;
		}

		route.push(sector);

		updateRouteLayer();
		updateValidationUI();
	});

	OLMap.on('pointerdrag', function (evt) {
		if (!panMode) {
			panMode = true;
			jQuery('#center').css('display', 'flex');
			stopAnimation();
			updateOwnshipLayer();

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
	jQuery('#open_traffic').click(() => {
		openSideMenu("traffic");
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
}

function updateClock() {
	date = new Date();
	jQuery("#clock").text(getTwoDigitText(date.getUTCHours()) + ":" + getTwoDigitText(date.getUTCMinutes()) + ":" + getTwoDigitText(date.getUTCSeconds()));
}

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

		const pointFeatures = new ol.Feature(new ol.geom.Point(route[i].endPoint));
		pointFeatures.setStyle(pointStyle);
		routeFeatures.push(pointFeatures);
	}

	if (route.length > 1) {
		const routePoints = route.map(a => a.endPoint);
		const lineFeatures = new ol.Feature(new ol.geom.LineString(routePoints));
		lineFeatures.setStyle(lineStyle);
		routeFeatures.push(lineFeatures);

		const activeLineFeatures = new ol.Feature(new ol.geom.LineString([route[1].endPoint, route[0].endPoint]));
		activeLineFeatures.setStyle(lineStyleActive);
		routeFeatures.push(activeLineFeatures);
	}

	routeSource.clear();

	if (routeFeatures.length > 0) {
		routeSource.addFeatures(routeFeatures);
	}
}

function updateOwnshipLayer() {

	ownshipSVG = 'data:image/svg+xml;utf8,' + escape(svgShapeToSVG(shapes['cessna'], (airborneCount == 0) ? greenColour : 'grey', '#000000', globalScale));

	styleArrey[1] = new ol.style.Style({
		image: new ol.style.Icon({
			scale: 2.5,
			src: ownshipSVG,
			rotation: renderPars.radTrack + OLMap.getView().getRotation(),
		}),
		zIndex: 200,
	});

	styleArrey[3] = new ol.style.Style({
		image: new ol.style.Icon({
			scale: 1.4,
			src: trackBugSVG,
			rotation: OLMap.getView().getRotation() + ((renderPars.radDtk) ? renderPars.radDtk : renderPars.radMagVar),
		}),
		zIndex: 195,
	});

	styleArrey[2] = new ol.style.Style({
		image: new ol.style.Icon({
			scale: 1.4,
			src: trackSVG,
			rotation: renderPars.radTrack + OLMap.getView().getRotation(),
		}),
		zIndex: 200,
	});

	styleArrey[4] = new ol.style.Style({
		image: new ol.style.Icon({
			scale: 1.4,
			src: compassSVG,
			rotation: OLMap.getView().getRotation() + renderPars.radMagVar,
		}),
		zIndex: 190,
	});

	viewPoint.setCoordinates(ownship.mapPosition);
	ownshipIcon = new ol.Feature(viewPoint);
	ownshipIcon.setStyle(styleArrey);
	ownshipSource.clear();
	ownshipSource.addFeatures([ownshipIcon]);

}

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

		const track = (airborneMode) ? ownship.toGoDtk : route[1].bearing;
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
		case "traffic":
			jQuery('#menu_title').text('ADS-B Traffic');
			jQuery('#traffic_items').css('display', 'block');
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
			jQuery('#menu_setting_buttons').css('display', 'block');
			jQuery('#menu_flight_plan_buttons').css('display', 'none');
			jQuery('#back_button').css('display', 'none');
			break;
		case "show_menu_flight_plan_buttons":
			jQuery('#show_menu_setting_buttons').css('background', backgroundColour);
			jQuery('#show_menu_flight_plan_buttons').css('background', foregroundColour);
			jQuery('#menu_setting_buttons').css('display', 'none');
			jQuery('#menu_flight_plan_buttons').css('display', 'block');
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

		if (route.length < 2) {
			resetUI();
			departure = null;
		}

		if (route.length == 0) {
			departure = null;
		}
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
	departure = null;
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
		let sector = new SectorObject(completedRoute[i].endPoint);
		sector.clone(completedRoute[i]);
		route.unshift(sector);
		completedRoute[i].setNull();
	}

	completedRoute = [];
	ownship.atd = null;
	updateRouteLayer();
	updateValidationUI();
	closeSideMenu();
}

function removeFirstWaypoint() {
	if (route.length > 1) {
		let sector = new SectorObject(route[0].endPoint);
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

	const latlong = ol.proj.toLonLat(mapLatLong);

	if (airpotList) {
		for (let i = 0; i < airpotList.length; i++) {
			if (greatCircleDistance(latlong, airpotList[i].geometry.coordinates) < 2) {
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
		jQuery('#departure').text(departure);
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

			course = '<td class="mid_font">' + getThreeDigitText(route[i].bearing) + '</td>';
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
	return (value == null) ? "" : ('00' + Math.round(value)).slice(-3);
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
		updateOwnshipLayer();
		jQuery('#north_up').css('display', 'none');
	}
}

function updateOwnship(position) {
	if (position.coords != null) {
		ownship.position = [position.coords.longitude, position.coords.latitude];
	}
	else {
		ownship.position = position;
	}

	let localDate = new Date();
	ownship.fixTime = localDate.getTime();

	if (ownship.lastPosition != null) {
		let deltaTime = ownship.fixTime - ownship.lastFixTime;
		ownship.gs = greatCircleDistance(ownship.lastPosition, ownship.position) * 3600000 / deltaTime;
		ownship.track = calculateBearing(ownship.lastPosition, ownship.position);
		ownship.magVar = getMagVar(ownship.lastPosition, ownship.position, false);
		ownship.mapPosition = ol.proj.fromLonLat(ownship.position);

		if (position.coords) ownship.gpsAccuracy = position.coords.accuracy;

		if (airborneCount == 0 && !airborneMode) {
			panMode = false;
			northUp = false;
			airborneMode = true;

			jQuery('#north_up').css('display', 'flex');
			startAnimation();
		}

		if (ownship.gs > 30 && airborneCount > 0) {
			airborneCount--;
		}

		jQuery('#gs').text(getRoundText(ownship.gs));
		jQuery('#trk').text(getThreeDigitText((ownship.track - ownship.magVar) % 360));

		if (airborneMode && !ownship.atd) {
			ownship.atd = [localDate.getUTCHours(), localDate.getUTCMinutes() + (localDate.getUTCSeconds() / 60)];
		}

		if (airborneMode && route.length > 0) {
			let point = (route.length == 1) ? 0 : 1;

			ownship.toGoDis = greatCircleDistance(ownship.position, route[point].latlong);
			ownship.toGoDtk = (calculateBearing(ownship.position, route[point].latlong) - getMagVar(ownship.position, route[point].latlong, true)) % 360;
			ownship.toGs = Math.max(10, ownship.gs * Math.cos(toRadians(ownship.track - ownship.magVar - ownship.toGoDtk)));

			getClosingTime();

			if (route[point].fuelFlow) {
				ownship.routeFuelReq = route[point].fuelFlow * (ownship.ete[0] + (ownship.ete[1] / 60));
				ownship.totalFuel -= route[point].fuelFlow * deltaTime / 3600000;
			}

			const headingDiff = Math.abs(ownship.toGoDtk - ownship.track) % 360;

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
		else {
			updateOwnshipLayer();
		}
	}

	ownship.lastPosition = ownship.position;
	ownship.lastFixTime = ownship.fixTime;
}

function gpsError(error) {
	navigator.geolocation.clearWatch(gpsWatchID);
	log('Warning: ' + error.message);
	jQuery('#gps').css('display', 'flex');
	document.getElementById('gps').innerHTML = svgShapeToSVG(ui['satellite'], redColour, '#ffffff', overlayButtonSize * globalScale);
	ownship.gpsAccuracy = null;
}

function centerMap() {
	panMode = false;
	jQuery('#center').css('display', 'none');
	jQuery('#north_up').css('display', 'flex');

	startAnimation();
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
	if (!ownship.position && !ownship.track) return;

	OLMap.getView().cancelAnimations();
	OLMap.getView().animate(
		{
			center: ol.proj.fromLonLat([ownship.position[0], ownship.position[1]]),
			rotation: (northUp) ? 0 : toRadians(-ownship.track),
			duration: duration,
		},
	);
}

function onPostrender(event) {
	if (ownship.mapPosition) {
		styleArrey[1] = new ol.style.Style({
			image: new ol.style.Icon({
				scale: 2.5,
				src: ownshipSVG,
				rotation: renderPars.radTrack + OLMap.getView().getRotation(),
			}),
			zIndex: 200,
		});

		styleArrey[2] = new ol.style.Style({
			image: new ol.style.Icon({
				scale: 1.4,
				src: trackBugSVG,
				rotation: OLMap.getView().getRotation() + ((renderPars.radDtk) ? renderPars.radDtk : renderPars.radMagVar),
			}),
			zIndex: 195,
		});

		styleArrey[3] = new ol.style.Style({
			image: new ol.style.Icon({
				scale: 1.4,
				src: trackSVG,
				rotation: renderPars.radTrack + OLMap.getView().getRotation(),
			}),
			zIndex: 200,
		});

		styleArrey[4] = new ol.style.Style({
			image: new ol.style.Icon({
				scale: 1.4,
				src: compassSVG,
				rotation: OLMap.getView().getRotation() + renderPars.radMagVar,
			}),
			zIndex: 190,
		});

		viewPoint.setCoordinates(ownship.mapPosition);
		let vectorContext = ol.getVectorContext(event);

		if (simMode) {
			ownshipIcon.setStyle(styleArrey);
		}
		else {
			for(let i = 0; i < styleArrey.length; i++)
			{
				vectorContext.setStyle(styleArrey[i]);
				vectorContext.drawGeometry(viewPoint);
			}
		}
	}
}

function startAnimation() {
	if (animate) return;

	if (!simMode) ownshipIcon.setGeometry(null);
	ownshipLayer.on('postrender', onPostrender);
	animate = true;
}

function stopAnimation() {
	if (!animate) return;

	ownshipLayer.un('postrender', onPostrender);
	animate = false;
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

		const response = await fetch(flightPlanData + '?filename=' + fileName, {
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
		const response = await fetch(flightPlanData + '?filename=flight_plans/' + fileName);

		if (response.ok) {

			clearFlightPlan(false);

			const result = await response.json(); // Parse JSON response
			ownship = result.ownship;

			for (let i = 0; i < result.route.length; ++i) {
				let newSector = new SectorObject(result.route[i].endPoint);
				newSector.clone(result.route[i]);
				route.push(newSector);
			}

			if (result.completedRoute) {
				for (let i = 0; i < result.completedRoute.length; ++i) {
					let newSector = new SectorObject(result.completedRoute[i].endPoint);
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
		const response = await fetch(flightPlanData);

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
		const response = await fetch(flightPlanData + '?filename=nav/au_apt');

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

	compassUnderlayStyle = new ol.style.Style({
		image: new ol.style.Circle({
			radius: 153 * globalScale,
			stroke: new ol.style.Stroke({ color: [255, 255, 255, 0.75], width: 35 * globalScale }),
		}),
		zIndex: 189,
	});

	initIcons();
	updateRouteLayer();
	jQuery('#zoom').text(getDecimalText(globalScale));
}

initialize();