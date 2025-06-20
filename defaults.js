"use strict";

const url = "https://server.eldercodes.net";
const aircraftData = url + "/api/data/";
const flightPlanData = url + "/navfr/api";
const DisplayUnits = "nautical";
const CenterLat = -32.795;
const CenterLon = 151.834;
const zoomLvl = 11.42;

//Styling
const labelFont = 'bold 1em tahoma';
const labelColor = new ol.style.Fill({ color: 'white' });
const bgFill = new ol.style.Fill({ color: 'rgba(0, 0, 0, 0.6)' });
const routeWidth = 5;
const activeRouteWidth = 7;
const routeColor = 'black';
const activeRouteColor = '#FD3DB5';
const pointColor = new ol.style.Fill({ color: routeColor });
const pointStroke = new ol.style.Stroke({ color: 'white', width: 2 });
const pointRadius = 6;
const blueColour = '#0066cc';
const greenColour = '#00cc22';
const amberColour = '#cc9900';
const redColour = '#cc0000';
const darkGreenColour = '#00400b';
const mainButtonSize = 1.5;
const overlayButtonSize = 1.25;