"use strict";

let layers;
let layersGroup;
let OLMap = null;
let timers = {};
let date = null;
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

//Map settings
let northUp = true;
let panMode = false;

let shapes = {
	'cessna': {
        id: 3,
        w: 26,
        h: 26,
        viewBox: '0 -1 32 31',
        strokeScale: 1.2,
        path: 'M16.36 20.96l2.57.27s.44.05.4.54l-.02.63s-.03.47-.45.54l-2.31.34-.44-.74-.22 1.63-.25-1.62-.38.73-2.35-.35s-.44-.1-.43-.6l-.02-.6s0-.5.48-.5l2.5-.27-.56-5.4-3.64-.1-5.83-1.02h-.45v-2.06s-.07-.37.46-.34l5.8-.17 3.55.12s-.1-2.52.52-2.82l-1.68-.04s-.1-.06 0-.14l1.94-.03s.35-1.18.7 0l1.91.04s.11.05 0 .14l-1.7.02s.62-.09.56 2.82l3.54-.1 5.81.17s.51-.04.48.35l-.01 2.06h-.47l-5.8 1-3.67.11z',
    },
}

let svg = '<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="26px" height="26px" viewBox="0 -1 32 31" enable-background="new 0 -1 32 31" xml:space="preserve">'+    
'<path stroke="#000000" stroke-width="0.5" fill="#00cc22" d="M16.36 20.96l2.57.27s.44.05.4.54l-.02.63s-.03.47-.45.54l-2.31.34-.44-.74-.22 1.63-.25-1.62-.38.73-2.35-.35s-.44-.1-.43-.6l-.02-.6s0-.5.48-.5l2.5-.27-.56-5.4-3.64-.1-5.83-1.02h-.45v-2.06s-.07-.37.46-.34l5.8-.17 3.55.12s-.1-2.52.52-2.82l-1.68-.04s-.1-.06 0-.14l1.94-.03s.35-1.18.7 0l1.91.04s.11.05 0 .14l-1.7.02s.62-.09.56 2.82l3.54-.1 5.81.17s.51-.04.48.35l-.01 2.06h-.47l-5.8 1-3.67.11z"/>'+
'</svg>';

function initialize() 
{
	initMap();
	initEvents();
	initTimers();
	initButtons();
	
	geoMag = geoMagFactory(cof2Obj());
	
	ownship.position = null;
	ownship.mapPosition = null;
	ownship.fixTime = null;
	ownship.lastPosition = null;
	ownship.lastFixTime = null;
	ownship.ias = null;
	ownship.track = null;
	ownship.toGoDis = 0;
	ownship.toGoDtk = 0;
		
	if ("geolocation" in navigator) 
	{
		let options = {
			enableHighAccuracy: true,
			timeout: 60000,
			maximumAge: 0,
		};
		
		gpsWatchID = navigator.geolocation.watchPosition(calculateFlight, gpsError, options);
	} 
	
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
        zIndex: 150,
		declutter: false,
		renderBuffer: 60,
    });
	
	layers.push(routeLayer);
	
	let ownshipLayer = new ol.layer.Vector({
		name: 'ownshipLayer',
		title: 'Ownship position',
		type: 'overlay',
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
		interactions: new ol.interaction.defaults({altShiftDragRotate:false, pinchRotate:false,}),
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
		
		let sector = new SectorObject(findClosestPoint(evt.coordinate));
		sector.setName(route.length);
		
		if(route.length > 0)
		{
			sector.distance = greatCircleDistance(route[route.length-1].latlong, sector.latlong);
			sector.bearing = (calculateBearing(route[route.length-1].latlong, sector.latlong) - getMagVar(route[route.length-1].latlong, sector.latlong, true)) % 360;//(calculateBearing(route[route.length-1].latlong, sector.latlong) - getMagVar(route[route.length-1].latlong, sector.latlong, true)) % 360;
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
	
	OLMap.on('click', function(evt)
	{
		evt.preventDefault();
		calculateFlight(ol.proj.toLonLat(evt.coordinate));
	});
	
	addEventListener("fullscreenchange", (event) => {
		if (!document.fullscreenElement) 
		{
			jQuery('#toggle_fullscreen').text('Enter Fullscreen');
			jQuery('#toggle_fullscreen').css('background', '#0059b3');
		} 
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
	let ownshipFeatures = [];
	ownshipSource.clear();
	
	if(ownship.position != null)
	{	
		let glPlaneIcon = new ol.Feature(new ol.geom.Point(ownship.mapPosition));
		
		let mysvg = new Image();
		mysvg.src = 'data:image/svg+xml,' + encodeURIComponent(svg);
		
		glPlaneIcon.setStyle(new ol.style.Style({
			image: new ol.style.Icon({
				scale: 2.5,
                imgSize: [26,26],
                img: mysvg,
				rotation: (northUp) ? toRadians(ownship.track) : 0,
            }),
                zIndex: 200,
            }));
			
		glPlaneIcon.visible = true
		
		console.log(mysvg);
		
		ownshipFeatures.push(glPlaneIcon);
		ownshipSource.addFeatures(ownshipFeatures);
	}
}

function updateNavData()
{
	let totalDistance = 0;
	
	if(route.length > 1)
	{
		totalDistance += (airborneCount == 0) ? ownship.toGoDis : route[1].distance;
		const track = (airborneCount == 0) ? ownship.toGoDtk : route[1].bearing;
		
		jQuery('#dis').text(getDecimalText(totalDistance));
		jQuery('#desired_trk').text(getThreeDigitText(track));
		jQuery('#wp_dis').text(route[1].sectorName);
		jQuery('#wp_ete').text(route[1].sectorName);
		
		for(let i = 2; i < route.length; ++i)
		{
			totalDistance += route[i].distance;
		}
		
		jQuery('#total_dis').text(getDecimalText(totalDistance));
		jQuery('#alt').text(getFourDigitText(route[1].altitude, false));
		jQuery('#ete').text(getTimeText(route[1].ete, false));		
	}
	else if (route.length == 1 && airborneCount == 0)
	{
		jQuery('#dis').text(getDecimalText(ownship.toGoDis));
		jQuery('#total_dis').text(getDecimalText(ownship.toGoDis));
		jQuery('#desired_trk').text(getThreeDigitText(ownship.toGoDtk));
		jQuery('#wp_dis').text(route[0].sectorName);
		jQuery('#wp_ete').text(route[0].sectorName);
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
		
		if  (!wakeLock)
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
}

function openTraffic()
{
	jQuery('#menu_title').text('ADS-B Traffic');
	jQuery('#traffic_items').css('display', 'block');
	jQuery('#menu').css('width', '100%');
}

function openLog()
{
	jQuery('#menu_title').text('Debug Log');
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
	jQuery('#dis').text('0.0');
	jQuery('#desired_trk').text('000');
	jQuery('#wp_dis').text('WP');
	jQuery('#wp_ete').text('WP');
	jQuery('#ete').text('00:00');
	jQuery('#alt').text('0000');
	jQuery('#total_dis').text('0.0');
	jQuery('#eta').text('00:00');
	jQuery('#landing_fuel').text('0.0');
}

function removeLastWaypoint()
{	
	if(route.length > 0)
	{
		route[route.length-1].setNull();
		route.pop();
		updateRouteLayer();
		updateValidationUI();
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
	let newBody = document.createElement('tbody');
	let htmlTable = document.getElementById('flight_table');
	let tbody = htmlTable.tBodies[0];
	
	jQuery('#departure').text('N/A');
	jQuery('#destination').text('N/A');

	if(route.length > 1)
	{
		let totalDistance = 0;
		let eta = [];
		
		jQuery('#departure').text(departure);
		jQuery('#destination').text(route[route.length-1].sectorName);
		
		for(let i = 1; i < route.length; ++i)
		{
			totalDistance += route[i].distance;
			
			let newRow = document.createElement('tr');
			let rowConstruct = '<td>' + route[i].sectorName + '</td>';
			rowConstruct += '<td><input type="number"  class="mid_font" id="' + i + '_alt" value="' + getFourDigitText(route[i].altitude, true) + '" step="100" min="0" size="10"></td>';
			rowConstruct += '<td><input type="number"  class="mid_font" id="' + i + '_ias" value="' + getRoundText(route[i].ias) + '" min="0" size="10"></td>';
			rowConstruct += '<td>' + getThreeDigitText(route[i].bearing) + '</td>';
			rowConstruct += '<td><input type="number"  class="mid_font" id="' + i + '_wind_dir" value="' + getThreeDigitText(route[i].windDir) + '" min="1" max="360"			size="10"></td>';
			rowConstruct += '<td><input type="number"  class="mid_font" id="' + i + '_wind_spd" value="' + getRoundText(route[i].windSpd) + '" min="0" size="10"></td>';
			rowConstruct += '<td class="mid_font">' + getThreeDigitText(route[i].heading) + '</td>';
			rowConstruct += '<td>' + getRoundText(route[i].groundSpeed) + '</td>';
			rowConstruct += '<td class="mid_font">' + getDecimalText(route[i].distance) + '</td>';
			rowConstruct += '<td class="mid_font">' + getDecimalText(totalDistance) + '</td>';
			rowConstruct += '<td class="mid_font">' + getTimeText(route[i].ete, true) + '</td>';
			rowConstruct += '<td class="mid_font">' + getTimeText(eta, true) + '</td>';
			newRow.innerHTML = rowConstruct;
			newBody.appendChild(newRow);
		}
	}
	
	htmlTable.replaceChild(newBody, tbody);
	tbody.remove();
}

function calculateFlightPlan()
{
	let table_alt = null;
	let table_ias = null;
	let table_wind_dir = null;
	let table_wind_spd = null;
	
	flightPlanValidated = true;
	
	for(let i = 1; i < route.length; ++i)
	{
		table_alt = document.getElementById(i + '_alt').value;
		table_ias = document.getElementById(i + '_ias').value;
		table_wind_dir = document.getElementById(i + '_wind_dir').value;
		table_wind_spd = document.getElementById(i + '_wind_spd').value;
		
		if(table_alt == "" || table_ias == "" || table_wind_dir == "" || table_wind_spd == "")
		{
			flightPlanValidated = false;
		}
		
		route[i].altitude = (table_alt == "") ? null : Number(table_alt);
		route[i].ias = (table_ias == "") ? null : Number(table_ias);
		route[i].windDir = (table_wind_dir == "") ? null : Number(table_wind_dir);
		route[i].windSpd = (table_wind_spd == "") ? null : Number(table_wind_spd);
		route[i].calculateWindCorrection();
	}
	
	generateFlightPlanTable();
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
		return "0000";
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
		return "00:00";
	}
	
	return ('0' + value[0]).slice(-2) + ":" + ('0' + Math.floor(value[1])).slice(-2);
}

function getRoundText(value)
{
	return (value == null || isNaN(value)) ? "0" : Math.round(value);
}

function getDecimalText(value)
{
	return (value == null) ? "" : (Math.round(value * 10)/ 10).toFixed(1);
}

function calculateFlight(position)
{
	if(position.coords != null)
	{
		ownship.position = [position.coords.longitude, position.coords.latitude];
	}
	else
	{
		ownship.position = position;
	}
	
	ownship.fixTime = new Date().getTime();
	
	if(ownship.lastPosition != null)
	{
		ownship.ias = greatCircleDistance(ownship.lastPosition, ownship.position) * 3600000 / (ownship.fixTime - ownship.lastFixTime);
		ownship.track = calculateBearing(ownship.lastPosition, ownship.position);
		ownship.mapPosition = ol.proj.fromLonLat(ownship.position);
		
		jQuery('#gs').text(getRoundText(ownship.ias));
		jQuery('#trk').text(getThreeDigitText((ownship.track - getMagVar(ownship.lastPosition, ownship.position, false)) % 360));
		
		updateOwnshipLayer();
		
		if(!northUp)
		{
			OLMap.getView().setRotation(toRadians(-ownship.track));
		}
		
		if(!panMode)
		{
			OLMap.getView().setCenter(ol.proj.fromLonLat([ownship.position[0], ownship.position[1]]));
		}
		
		if(ownship.ias > 30 && airborneCount > 0)
		{
			airborneCount--;
		}
		
		if(airborneCount == 0 && route.length > 0)
		{
			let point = (route.length == 1) ? 0 : 1;
			
			ownship.toGoDis = greatCircleDistance(ownship.position, route[point].latlong);
			ownship.toGoDtk = (calculateBearing(ownship.position, route[point].latlong) - getMagVar(ownship.position, route[point].latlong, true)) % 360;
			
			if(ownship.toGoDis < 0.5)
			{
				removeFirstWaypoint();
			}
		}
	}
	
	ownship.lastPosition = ownship.position;
	ownship.lastFixTime = ownship.fixTime;
}

function gpsError(error)
{
	navigator.geolocation.clearWatch(gpsWatchID);
	log(error.message);
}

function log(string)
{
	let log = document.getElementById('log_items');
	let entry = document.createElement('div');
	entry.innerHTML = string;
	log.prepend(entry);
}

initialize();