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
let geoMag = null;
let currZoom = null;
let snap = true;
let flightPlanValidated = null;
let fuelPlanValidated = null;
let departure = null;
let wakeLock = null;
let ownship = {};
let gpsWatchID = null;
let ownshipShape = null;
let airborneCount = 3;
let airborneMode = null;
let canRemoveWaypoint = null;

let testMode = false;

//Map settings
let northUp = true;
let panMode = true;
let animate = false;

// Ownship
let viewPoint = new ol.geom.Point([0,0]);
let ownshipStyle = null;
let ownshipSVG = null;
let ownshipIcon = null;

function initialize() 
{
	let params = new URLSearchParams(document.location.search);
	
	if(params.get("test"))
	{
		testMode = true;
	}
	
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
	ownship.holdFuel = 0;

	airborneMode = false;
	canRemoveWaypoint = false;
		
	if ("geolocation" in navigator) 
	{
		let options = {
			enableHighAccuracy: true,
			timeout: 60000,
			maximumAge: 0,
		};
		
		gpsWatchID = navigator.geolocation.watchPosition(updateOwnship, gpsError, options);
	}	
}

function initIcons()
{
	document.getElementById('center').innerHTML = svgShapeToSVG(shapes['center'],'#ffffff', '#000000', overlayButtonSize);
	document.getElementById('north_up').innerHTML = svgShapeToSVG(shapes['plane'],'#ffffff', '#000000', overlayButtonSize);
	document.getElementById('open_fuel_plan').innerHTML = svgShapeToSVG(shapes['fuel'],'#ffffff', '#000000', mainButtonSize);
	document.getElementById('open_flight_plan').innerHTML = svgShapeToSVG(shapes['takeoff'],'#ffffff', '#000000', mainButtonSize);
	document.getElementById('direct_to').innerHTML = svgShapeToSVG(shapes['direct'],'#ffffff', '#000000', mainButtonSize);
	document.getElementById('open_traffic').innerHTML = svgShapeToSVG(shapes['wifi'],'#ffffff', '#000000', mainButtonSize);
	document.getElementById('open_menu').innerHTML = svgShapeToSVG(shapes['bars'],'#ffffff', '#000000', mainButtonSize);
	document.getElementById('close_menu').innerHTML = svgShapeToSVG(shapes['cross'],'#ffffff', '#000000', mainButtonSize);
}

function initMap()
{
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

function ol_map_init()
{
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
			altShiftDragRotate:false,
			pinchRotate: false,
			doubleClickZoom: false,
			dragPan: true,
			dragZoom: false
		}),
		maxTilesLoading: 4,
    });
}

function initTimers()
{	
	timers.clock = window.setInterval(updateClock, 500);
	updateClock();
	
	timers.navClock = window.setInterval(updateNavData, 1000);
}

function initEvents()
{
	OLMap.on('contextmenu', function(evt)
	{
		evt.preventDefault();

		const id = getNextID();
		let sector = new SectorObject(findClosestPoint(evt.coordinate));

		sector.sectorName = "WP" + id;
		sector.id = id;
				
		if(route.length > 0)
		{
			sector.distance = greatCircleDistance(route[route.length-1].latlong, sector.latlong);
			sector.bearing = (calculateBearing(route[route.length-1].latlong, sector.latlong) - getMagVar(route[route.length-1].latlong, sector.latlong, true)) % 360;
			flightPlanValidated = false;
			fuelPlanValidated = false;
		}
		
		if(route.length == 0)
		{
			departure = sector.sectorName;
		}
		
		route.push(sector);
		
		updateRouteLayer();	
		updateValidationUI();
	});
	
	OLMap.on('pointerdrag', function(evt)
	{
		if(!panMode)
		{
			panMode = true;
			jQuery('#center').css('display', 'flex');
			stopAnimation();
			updateOwnshipLayer();

			if(northUp)
			{
				jQuery('#north_up').css('display', 'none');
			}
		}
	});

	if(testMode)
	{
		OLMap.on('click', function(evt)
		{
			updateOwnship(ol.proj.toLonLat(evt.coordinate));

		});
	}
	
	addEventListener("fullscreenchange", (evt) => {
		if (!document.fullscreenElement) 
		{
			jQuery('#toggle_fullscreen').text('Enter Fullscreen');
			jQuery('#toggle_fullscreen').css('background', '#0059b3');
			releaseWakeLock();
		} 
	});
	
	addEventListener('error', function(evt) 
	{
		log('Error: [' + evt.lineno + '] ' + evt.message);
	});
}

function initButtons()
{
	jQuery('#open_flight_plan').click(openFlightPlan);
	jQuery('#open_fuel_plan').click(openFuelPlan);
	jQuery('#open_traffic').click(openTraffic);
	jQuery('#open_log').click(openLog);
	jQuery('#open_menu').click(openMenu);
	jQuery('#close_menu').click(closeMenu);
	jQuery('#toggle_fullscreen').click(toggleFullScreen);
	jQuery('#toggle_snap').click(toggleSnap);
	jQuery('#remove_last_waypoint').click(removeLastWaypoint);
	jQuery('#clear_flight_plan').click(clearFlightPlan);
	jQuery('#calc_flight_plan').click(calculateFlightPlan);
	jQuery('#calc_fuel_plan').click(calculateFuelPlan);
	jQuery('#center').click(centerMap);
	jQuery('#north_up').click(toggleNorthUp);
	
	jQuery('.ui_button').css('background', blueColour);
	jQuery('.menu_button').css('background', blueColour);
	jQuery('#toggle_snap').css('background', greenColour);
}

function updateClock()
{
	date = new Date();
	jQuery("#clock").text(getTwoDigitText(date.getUTCHours()) + ":" + getTwoDigitText(date.getUTCMinutes()) + ":" + getTwoDigitText(date.getUTCSeconds()));
}

function updateRouteLayer()
{
	let flipDiag = true;
	let routeFeatures = [];
			
	const lineStyle = new ol.style.Style({
		stroke: new ol.style.Stroke({
			color: routeColor,
			width: routeWidth,
		}),
		zIndex: 150,
	});
	
	const lineStyleActive = new ol.style.Style({
		fill: labelColor,
		stroke: new ol.style.Stroke({
			color: activeRouteColor,
			width: activeRouteWidth,
		}),
		zIndex: 150,
	});
	
	for(let i = route.length - 1; i >= 0; --i)
	{
		const pointStyle = new ol.style.Style({
			text: new ol.style.Text({
				text: route[i].sectorName,
				fill: labelColor,
				backgroundFill: bgFill,
				textAlign: 'left',
				textBaseline: 'bottom',
				font: labelFont,
				offsetX: 30,
				offsetY: 11,
				padding: [1, 10, -1, 12],
			}),
			image: new ol.style.Circle({
				radius: pointRadius,
				fill: pointColor,
				stroke: pointStroke,
			}),
			zIndex: 150,
		});
		
		const pointFeatures = new ol.Feature(new ol.geom.Point(route[i].endPoint));
		pointFeatures.setStyle(pointStyle);
		routeFeatures.push(pointFeatures);
	}
	
	if(route.length > 1)
	{
		const routePoints = route.map(a => a.endPoint);
		const lineFeatures = new ol.Feature(new ol.geom.LineString(routePoints));
		lineFeatures.setStyle(lineStyle);
		routeFeatures.push(lineFeatures);
		
		const activeLineFeatures = new ol.Feature(new ol.geom.LineString([route[1].endPoint, route[0].endPoint]));
		activeLineFeatures.setStyle(lineStyleActive);
		routeFeatures.push(activeLineFeatures);
	}
	
	routeSource.clear();

	if(routeFeatures.length > 0)
	{
		routeSource.addFeatures(routeFeatures);
	}
}

function updateOwnshipLayer()
{	
	
	ownshipSVG = 'data:image/svg+xml;utf8,' + escape(svgShapeToSVG(shapes['cessna'], (airborneCount == 0) ? greenColour : 'grey', '#000000', 1));

	ownshipStyle = new ol.style.Style({
		image: new ol.style.Icon({
			scale: 2.5,
			imgSize: [shapes['cessna'].w, shapes['cessna'].h],
			src: ownshipSVG,
			rotation: toRadians(ownship.track) + OLMap.getView().getRotation(),
		}),
		zIndex: 200,
	});

	viewPoint.setCoordinates(ownship.mapPosition);
	ownshipIcon = new ol.Feature(viewPoint);
	ownshipIcon.setStyle(ownshipStyle);
	ownshipSource.clear();
	ownshipSource.addFeatures([ownshipIcon]);

}

function updateNavData()
{
	let totalDistance = 0;
	let eta = (airborneMode) ? [Math.floor(date.getUTCHours()), date.getUTCMinutes()] : ownship.etd;
	let landingFuel = (fuelPlanValidated) ? ownship.totalFuel : null;
	
	jQuery('#landing_fuel').text('-.-');

	if(ownship.gpsAccuracy && ownship.gpsAccuracy > 10)
	{
		jQuery('#gps').css('display', 'flex');
		document.getElementById('gps').innerHTML = svgShapeToSVG(shapes['satellite'], amberColour, '#000000', overlayButtonSize);
	}
	else if(ownship.gpsAccuracy)
	{
		jQuery('#gps').css('display', 'none');
	}
	
	if(route.length > 1)
	{
		if(!flightPlanValidated) eta = [];	
		
		const track = (airborneMode) ? ownship.toGoDtk : route[1].bearing;
		const ete = (airborneMode) ? ownship.ete : route[1].ete;
		const routeFuel = (airborneMode) ? ownship.routeFuelReq : route[1].fuelRequired;
		totalDistance += (airborneMode) ? ownship.toGoDis : route[1].distance;
		
		if(flightPlanValidated) eta = addTime(eta, ete);
		if(fuelPlanValidated) landingFuel -= routeFuel;
		
		jQuery('#dis').text(getDecimalText(totalDistance));
		jQuery('#desired_trk').text(getThreeDigitText(track));
		jQuery('#wp_dis').text(route[1].sectorName);
		jQuery('#wp_ete').text(route[1].sectorName);
		
		for(let i = 2; i < route.length; ++i)
		{
			totalDistance += route[i].distance;
			if(flightPlanValidated) eta = addTime(eta, route[i].ete);
			if(fuelPlanValidated) landingFuel -= route[i].fuelRequired;
		}
		
		jQuery('#total_dis').text(getDecimalText(totalDistance));
		jQuery('#alt').text(getFourDigitText(route[1].altitude, false));		
		jQuery('#eta').text(getTimeText(eta, false));
		if(landingFuel > 0) jQuery('#landing_fuel').text(getDecimalText(landingFuel));
		
		if(ete[1] < 1)
		{
			jQuery('#ete').text(getTwoDigitText(ete[1] * 60));
		}
		else
		{
			jQuery('#ete').text(getTimeText(ete, false));
		}
	}
	else if (route.length == 1 && airborneMode)
	{
		jQuery('#dis').text(getDecimalText(ownship.toGoDis));
		jQuery('#total_dis').text(getDecimalText(ownship.toGoDis));
		jQuery('#desired_trk').text(getThreeDigitText(ownship.toGoDtk));
		jQuery('#wp_dis').text(route[0].sectorName);
		jQuery('#wp_ete').text(route[0].sectorName);
		jQuery('#eta').text(getTimeText(addTime(eta, ownship.ete), false));
		if(landingFuel > 0) jQuery('#landing_fuel').text(landingFuel - ownship.routeFuelReq);
		
		if(ownship.ete[1] < 1)
		{
			jQuery('#ete').text(getTwoDigitText(ownship.ete[1] * 60));
		}
		else
		{
			jQuery('#ete').text(getTimeText(ownship.ete, false));
		}
	}
}

async function toggleFullScreen() 
{
	if (!document.fullscreenElement) 
	{
		if (document.documentElement.requestFullscreen)
		{
			document.documentElement.requestFullscreen();
		} 
		else if (document.documentElement.mozRequestFullScreen) 
		{ /* Firefox */
			document.documentElement.mozRequestFullScreen();
		} 
		else if (document.documentElement.webkitRequestFullscreen) 
		{ /* Safari */
			document.documentElement.webkitRequestFullscreen();
		} else if (document.documentElement.webkitRequestFullscreen) 
		{ /* Safari */
			document.documentElement.webkitRequestFullscreen();
		} 
		else if (document.documentElement.msRequestFullscreen) 
		{ /* IE11 */
			document.documentElement.msRequestFullscreen();
		}
		
		jQuery('#toggle_fullscreen').css('background', greenColour);
		jQuery('#toggle_fullscreen').text('Exit Fullscreen');
		
		if('wakeLock' in navigator)
		{
			await requestWakeLock();
		}
	} 
	else 
	{
		if (document.exitFullscreen) 
		{
			document.exitFullscreen();	
		}
		else if (document.mozCancelFullScreen)
		{
			document.mozCancelFullScreen();	
		}
		else if (document.webkitExitFullscreen)
		{
			document.webkitExitFullscreen();	
		}
		else if (document.msExitFullscreen)
		{
			document.msExitFullscreen();	
		}
		
		jQuery('#toggle_fullscreen').css('background', blueColour);
		jQuery('#toggle_fullscreen').text('Enter Fullscreen');
		
		releaseWakeLock();
	}
}

async function requestWakeLock()
{
	try 
	{
		wakeLock = navigator.wakeLock.request();
	} 
	catch (err) 
	{
		log(err.name + ": " + err.message);
	}
}

function releaseWakeLock()
{
	if (!wakeLock)
	{
		return;
	}
	try 
	{
		wakeLock.then(wls => wls.release())
		wakeLock = null;
	}  
	catch (err) 
	{
		log(err.name + ": " + err.message);
	}
}

function openMenu()
{
	jQuery('#menu_title').text('Menu');
	jQuery('#menu_items').css('display', 'block');
	jQuery('#menu').css('width', '100%');
}

function openFlightPlan()
{
	jQuery('#menu_title').text('Flight Plan');
	jQuery('#flight_items').css('display', 'block');
	jQuery('#menu').css('width', '100%');
	
	generateFlightPlanTable();
}

function openFuelPlan()
{
	jQuery('#menu_title').text('Fuel Plan');
	jQuery('#fuel_items').css('display', 'block');
	jQuery('#menu').css('width', '100%');
	
	generateFuelPlanTable();
}

function openTraffic()
{
	jQuery('#menu_title').text('ADS-B Traffic');
	jQuery('#traffic_items').css('display', 'block');
	jQuery('#menu').css('width', '100%');
}

function openLog()
{
	jQuery('#menu_title').text('Error Log');
	jQuery('#log_items').css('display', 'block');
	jQuery('#menu').css('width', '100%');
	jQuery('#menu_items').css('display', 'none');
}

function closeMenu()
{
	jQuery('#menu_items').css('display', 'none');
	jQuery('#flight_items').css('display', 'none');
	jQuery('#fuel_items').css('display', 'none');
	jQuery('#traffic_items').css('display', 'none');
	jQuery('#log_items').css('display', 'none');
	jQuery('#menu').css('width', '0');
	jQuery('#menu_title').text('');
}

function toggleSnap()
{
	if(!snap)
	{
		jQuery('#toggle_snap').css('background', greenColour);
		jQuery('#toggle_snap').text('Waypoint Snap: On');
		snap = true;
	}
	else
	{
		jQuery('#toggle_snap').css('background', blueColour);
		jQuery('#toggle_snap').text('Waypoint Snap: Off');
		snap = false;
	}
}

function resetUI()
{
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

function removeLastWaypoint()
{	
	if(route.length > 0)
	{
		route[route.length-1].setNull();
		route.pop();
		updateRouteLayer();
		generateFlightPlanTable();
		generateFuelPlanTable();
		calculateFlightPlan();
		calculateFuelPlan();
		closeMenu();
		
		if(route.length < 2)
		{
			resetUI();
			departure = null;
		}
		
		if(route.length == 0)
		{
			departure = null;
		}
	}
}

function clearFlightPlan()
{
	resetUI();
	
	for(let i = 0; i < route.length; ++i)
	{
		route[i].setNull();
	}
	
	route = [];
	departure = null;
	
	updateRouteLayer();
	updateValidationUI();
	closeMenu();
}

function removeFirstWaypoint()
{	
	if(route.length > 1)
	{
		route[0].setNull();
		route.shift();
		updateRouteLayer();
		updateValidationUI();
	}
}

function findClosestPoint(latlong)
{
	if(!snap)
	{
		return latlong;
	}
	
	return latlong;
}

function generateFlightPlanTable()
{	
	jQuery('#departure').text('N/A');
	jQuery('#destination').text('N/A');
	
	if(ownship.atd)
	{
		jQuery('#atd').css('display','inline-block');
		jQuery('#atd').text(getTimeText(ownship.atd, false) + ' z');
		jQuery('#etd_input').css('display','none');
	}

	let newBody = document.createElement('tbody');
	let htmlTable = document.getElementById('flight_table');
	let tbody = htmlTable.tBodies[0];
	let eta = [];
	
	if(route.length > 0)
	{
		jQuery('#departure').text(departure);
		jQuery('#destination').text(route[route.length-1].sectorName);
	}

	if(route.length > 1)
	{
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
		
		for(let i = 1; i < route.length; ++i)
		{	
			newRow = document.createElement('tr');
			if(i == 1) newRow.id = "activeRow"; 	
			totalDistance += route[i].distance;
					
			if(flightPlanValidated)
			{
				if(eta.length != 2 && !airborneMode)
				{
					eta = addTime(ownship.etd, route[i].ete);
				}
				else if(eta.length != 2)
				{
					eta = addTime([Math.floor(date.getUTCHours()), date.getUTCMinutes()], ownship.ete);
				}
				else
				{
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
			
			if(i == 1 && airborneMode)
			{
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
	
	if(airborneMode) jQuery('#activeRow').css('background', darkGreenColour);
	jQuery('#fp_eta').text(getTimeText(eta, false));
}

function calculateFlightPlan()
{
	let table_alt = null;
	let table_ias = null;
	let table_wind_dir = null;
	let table_wind_spd = null;
	let table_heading = null;
	
	flightPlanValidated = true;
	
	ownship.etd = [Number(document.getElementById('etd_hours').value), Number(document.getElementById('etd_minutes').value)];
	
	for(let i = 1; i < route.length; ++i)
	{
		table_alt = document.getElementById(route[i].id + '_alt').value;
		table_ias = document.getElementById(route[i].id + '_ias').value;
		
		route[i].altitude = (table_alt == "") ? null : Number(table_alt);
		route[i].ias = (table_ias == "") ? null : Number(table_ias);
		
		if(i == 1 && airborneMode)
		{
			table_heading = document.getElementById(route[i].id + '_hdg').value;
			route[i].heading = (table_heading == "") ? null : Number(table_heading);
			route[i].calculateWind(ownship.toGoDtk, ownship.toGs);
		}
		else
		{
			table_wind_dir = document.getElementById(route[i].id + '_wind_dir').value;
			table_wind_spd = document.getElementById(route[i].id + '_wind_spd').value;
			
			route[i].windDir = (table_wind_dir == "") ? null : Number(table_wind_dir);
			route[i].windSpd = (table_wind_spd == "") ? null : Number(table_wind_spd);
			route[i].calculateWindCorrection();
		}
		
		if(table_alt == "" || table_ias == "" || table_wind_dir == "" || table_wind_spd == "")
		{
			flightPlanValidated = false;
		}
	}
	
	generateFlightPlanTable();
	updateValidationUI();
}

function generateFuelPlanTable()
{	
	let newBody = document.createElement('tbody');
	let htmlTable = document.getElementById('fuel_table');
	let tbody = htmlTable.tBodies[0];
	let requiredFuel = null;

	jQuery('#total_fuel').prop("value", getDecimalText(ownship.totalFuel));

	if(route.length > 1)
	{
		let totalFuelRemaining = ownship.totalFuel;
		let ete = null;
		let fuelRequiredField = null;
		let newRow = null;
		let rowConstruct = null;
		requiredFuel = 0;

		for(let i = 1; i < route.length; ++i)
		{
			newRow = document.createElement('tr');
			if(i == 1) newRow.id = "activeRowFuel"; 

			ete = '<td class="mid_font">' + getTimeText(route[i].ete, true) + '</td>';
			fuelRequiredField = '<td class="mid_font">' + getDecimalText(route[i].fuelRequired) + '</td>';
			
			if(i == 1 && airborneMode)
			{
				ete = '<td class="mid_font">' + getTimeText(ownship.ete, true) + '</td>';
				fuelRequiredField = '<td class="mid_font">' + getDecimalText(ownship.routeFuelReq) + '</td>';
				totalFuelRemaining -= ownship.routeFuelReq;
				requiredFuel += ownship.routeFuelReq;
			}
			else
			{
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

		if(ownship.holdFuel)
		{
			totalFuelRemaining -= ownship.holdFuel;
			requiredFuel += ownship.holdFuel;
		}

		newRow = document.createElement('tr');
		rowConstruct = '<td class="mid_font">Hold Fuel</td>';
		rowConstruct += '<td class="mid_font">-</td><td class="mid_font">-</td><td class="mid_font">-</td>'
		rowConstruct += '<td><input type="number"  class="mid_font" id="hold_fuel" value="' + getDecimalText(ownship.holdFuel) + '" step="0.1" min="0"></td>';
		rowConstruct += '<td class="mid_font">' + getDecimalText(totalFuelRemaining) + '</td>';
		newRow.innerHTML = rowConstruct;
		newBody.appendChild(newRow);

		if(ownship.reserveFuel)
		{ 
			
			totalFuelRemaining -= ownship.reserveFuel;
			requiredFuel += ownship.reserveFuel;
		}

		newRow = document.createElement('tr');
		rowConstruct = '<td class="mid_font">Reserve Fuel</td>';
		rowConstruct += '<td class="mid_font">-</td><td class="mid_font">-</td><td class="mid_font">-</td>'
		rowConstruct += '<td><input type="number"  class="mid_font" id="reserve_fuel" value="' + getDecimalText(ownship.reserveFuel) + '" step="0.1" min="0"></td>';
		rowConstruct += '<td class="mid_font">' + getDecimalText(totalFuelRemaining) + '</td>';
		newRow.innerHTML = rowConstruct;
		newBody.appendChild(newRow);

	}

	if(fuelPlanValidated && requiredFuel)
	{
		jQuery('#required_fuel').text(getDecimalText(requiredFuel));
	} 
	else
	{
		jQuery('#required_fuel').text('-.-');
	}
	
	htmlTable.replaceChild(newBody, tbody);
	tbody.remove();

	if(airborneMode) jQuery('#activeRowFuel').css('background', darkGreenColour);
}

function calculateFuelPlan()
{
	let table_fuel_flow = null;
	
	fuelPlanValidated = true;
	
	ownship.totalFuel = Number(document.getElementById('total_fuel').value);

	if(route.length > 1)
	{
		let reserveFuelField = document.getElementById('reserve_fuel').value;
		ownship.reserveFuel = (reserveFuelField == "") ? null : Number(reserveFuelField);
		ownship.holdFuel = Number(document.getElementById('hold_fuel').value);
	}
	
	for(let i = 1; i < route.length; ++i)
	{
		table_fuel_flow = document.getElementById(route[i].id + '_fuel_flow').value;
		route[i].fuelFlow = (table_fuel_flow == "") ? null : Number(table_fuel_flow);

		if(route[i].fuelFlow == null || !ownship.reserveFuel || ownship.reserveFuel == 0 || (!airborneMode && route[i].ete.length == 0)) fuelPlanValidated = false;

		if(i == 1 && airborneMode) ownship.routeFuelReq = route[i].fuelFlow * (ownship.ete[0] + (ownship.ete[1] / 60));

		if(route[i].ete.length != 0) route[i].fuelRequired = (route[i].ete[0] + (route[i].ete[1] / 60)) * route[i].fuelFlow;
	}
	
	generateFuelPlanTable();
	updateValidationUI();
}

function updateValidationUI()
{
	let flightPlanColour = (flightPlanValidated) ? greenColour : amberColour;
	let fuelPlanColour = (fuelPlanValidated) ? greenColour : amberColour;
	
	if(route.length < 2)
	{
		flightPlanColour = blueColour;
		fuelPlanColour = blueColour;
	}
		
	jQuery('#open_flight_plan').css('background', flightPlanColour);
	jQuery('#open_fuel_plan').css('background', fuelPlanColour);
}

function getTwoDigitText(value)
{
	return (value == null) ? "" : ('0' + Math.round(value)).slice(-2);
}

function getThreeDigitText(value)
{
	return (value == null) ? "" : ('00' + Math.round(value)).slice(-3);
}

function getFourDigitText(value, nullString)
{
	if(value == null && nullString)
	{
		return "";
	}
	else if(value == null)
	{
		return "----";
	}
	
	return ('000' + Math.round(value)).slice(-4);
}

function getTimeText(value, nullString)
{
	if(value.length == 0 && nullString)
	{
		return "";
	}
	else if(value.length == 0)
	{
		return "--:--";
	}
	
	return ('0' + value[0]).slice(-2) + ":" + ('0' + Math.floor(value[1])).slice(-2);
}

function getRoundText(value)
{
	return (value == null || isNaN(value)) ? "" : Math.round(value);
}

function getDecimalText(value)
{
	return (value == null) ? "" : (Math.round(value * 10)/ 10).toFixed(1);
}

function toggleNorthUp()
{
	northUp = !northUp;
	
	if(northUp)
	{ 
		document.getElementById('north_up').innerHTML = svgShapeToSVG(shapes['compass'],'#ffffff', '#000000', overlayButtonSize);
		jQuery('#north_up svg').css('transform', 'rotate(-45deg)');
	}
	else
	{
		document.getElementById('north_up').innerHTML = svgShapeToSVG(shapes['plane'],'#ffffff', '#000000', overlayButtonSize);
	}

	if(ownship.track && panMode && northUp)
	{
		OLMap.getView().setRotation(0);
		updateOwnshipLayer();
		jQuery('#north_up').css('display', 'none');
	}
}

function updateOwnship(position)
{	
	if(position.coords != null)
	{
		ownship.position = [position.coords.longitude, position.coords.latitude];
	}
	else
	{
		ownship.position = position;
	}
	
	let localDate =  new Date();
	ownship.fixTime = localDate.getTime();
	
	if(ownship.lastPosition != null)
	{
		let deltaTime = ownship.fixTime - ownship.lastFixTime;
		ownship.gs = greatCircleDistance(ownship.lastPosition, ownship.position) * 3600000 / deltaTime;
		ownship.track = calculateBearing(ownship.lastPosition, ownship.position);
		ownship.magVar = getMagVar(ownship.lastPosition, ownship.position, false);
		ownship.mapPosition = ol.proj.fromLonLat(ownship.position);
		
		if(position.coords) ownship.gpsAccuracy = position.coords.accuracy;
		
		if(airborneCount == 0 && !airborneMode)
		{
			panMode = false;
			northUp = false;
			airborneMode = true;
			
			jQuery('#north_up').css('display', 'flex');
			startAnimation();
		}

		if(ownship.gs > 30 && airborneCount > 0) 
		{
			airborneCount--;
		}
		
		jQuery('#gs').text(getRoundText(ownship.gs));
		jQuery('#trk').text(getThreeDigitText((ownship.track - ownship.magVar) % 360));
		
		if(!panMode) 
		{
			animateView(ol.proj.fromLonLat([ownship.position[0], ownship.position[1]]), deltaTime, true);
		}
		else
		{
			updateOwnshipLayer();
		}
		
		if(airborneMode && !ownship.atd)
		{
			ownship.atd = [Math.floor(localDate.getUTCHours()), localDate.getUTCMinutes()];
		}
		
		if(airborneMode && route.length > 0)
		{
			let point = (route.length == 1) ? 0 : 1;
			
			ownship.toGoDis = greatCircleDistance(ownship.position, route[point].latlong);
			ownship.toGoDtk = (calculateBearing(ownship.position, route[point].latlong) - getMagVar(ownship.position, route[point].latlong, true)) % 360;
			ownship.toGs = Math.max(10, ownship.gs * Math.cos(toRadians(ownship.track - ownship.magVar - ownship.toGoDtk)));

			getClosingTime();

			if(route[point].fuelFlow)
			{
				ownship.routeFuelReq = route[point].fuelFlow * (ownship.ete[0] + (ownship.ete[1] / 60));
				ownship.totalFuel -= route[point].fuelFlow * deltaTime / 3600000;
			}

			const headingDiff = Math.abs(ownship.toGoDtk - ownship.track) % 360;

			if(((headingDiff > 180) ? 360 - headingDiff : headingDiff) < 90 && !canRemoveWaypoint)
			{
				canRemoveWaypoint = true;
			}

			if(ownship.toGoDis < 0.1 || (ownship.toGoDis < 3.0 && ((headingDiff > 180) ? 360 - headingDiff : headingDiff) > 90 && canRemoveWaypoint))
			{
				removeFirstWaypoint();
				canRemoveWaypoint = false;
			}
			
			ownship.prevToGoDis = ownship.toGoDis;
		}
	}
	
	ownship.lastPosition = ownship.position;
	ownship.lastFixTime = ownship.fixTime;
}

function gpsError(error)
{
	navigator.geolocation.clearWatch(gpsWatchID);
	log('Warning: ' + error.message);
	jQuery('#gps').css('display', 'flex');
	document.getElementById('gps').innerHTML = svgShapeToSVG(shapes['satellite'], redColour, '#000000', overlayButtonSize);
	ownship.gpsAccuracy = null;
}

function centerMap()
{
	panMode = false;
	jQuery('#center').css('display', 'none');
	jQuery('#north_up').css('display', 'flex');
	
	if(ownship.position)
	{
		startAnimation();
		animateView(ol.proj.fromLonLat([ownship.position[0], ownship.position[1]]), 500, false);
	}
}

function getClosingTime()
{
	if(!ownship.toGoDtk && !ownship.toGoDis && !ownship.track)
	{
		ownship.ete = [];
		return;
	}
	
	const hours = ownship.toGoDis / ownship.toGs;
	
	ownship.ete = [Math.floor(hours), (hours - Math.floor(hours)) * 60];
}

function addTime(time1, time2)
{
	let minutes = time1[1] + time2[1];
	let hours = Math.floor(minutes / 60);
	
	minutes -= hours * 60;
	hours += time1[0] + time2[0];
	
	return [hours % 24, minutes];
}

function log(string)
{
	let log = document.getElementById('log_items');
	let entry = document.createElement('div');
	entry.innerHTML = string;
	log.prepend(entry);
}

function animateView(newPoint, duration, show) 
{
	const view = OLMap.getView();
	view.cancelAnimations();
	
	view.animate(
		{
			center: newPoint,
			rotation: (northUp) ? 0 : toRadians(-ownship.track),
			duration: duration,
		},
	);
}

function onPostrender(event) 
{
	if(ownship.mapPosition)
	{
		ownshipStyle = new ol.style.Style({
			image: new ol.style.Icon({
				scale: 2.5,
				imgSize: [shapes['cessna'].w, shapes['cessna'].h],
				src: ownshipSVG,
				rotation: toRadians(ownship.track) + OLMap.getView().getRotation(),
			}),
			zIndex: 200,
		});

		viewPoint.setCoordinates(ownship.mapPosition);
		let vectorContext = ol.getVectorContext(event);
		vectorContext.setStyle(ownshipStyle);
		vectorContext.drawGeometry(viewPoint);
	}
}

function startAnimation()
{
	if(animate) return;
	
	ownshipIcon.setGeometry(null);
	ownshipLayer.on('postrender', onPostrender);
	animate = true;
}

function stopAnimation()
{
	if(!animate) return;

	ownshipLayer.un('postrender', onPostrender);
	animate = false;
}

function getNextID()
{
	let id = 0;

	for(let i = 0; i < route.length; ++i)
	{
		if(route[i].id > id) id = route[i].id;
	}

	return id + 1;
}

initialize();