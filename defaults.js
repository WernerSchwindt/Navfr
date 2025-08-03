"use strict";

const url = "https://server.eldercodes.net"; //Change this to your server domain.
const apiData = url + "/navfr/api";
const DisplayUnits = "nautical";
const CenterLat = -32.795;
const CenterLon = 151.834;
const zoomLvl = 11.42;

//Edit this to add your own maps
const maps = [
    {id: "newcastle_vtc", name: "Newcastle VTC", url: ""},
    {id: "sydney_vtc", name: "Sydney VTC", url: ""},
    {id: "tamworth_vtc", name: "Tamworth VTC", url: ""},
    {id: "brisbane_vtc", name: "Brisbane VTC", url: ""},
    {id: "rockhampton_vtc", name: "Rockhampton VTC", url: ""},
    {id: "perth_vtc", name: "Perth VTC", url: ""},
    {id: "Newcastle_vnc", name: "Newcastle VNC", url: "/geoserver/gwc/service/tms/1.0.0/ne:world@EPSG:900913@png/{z}/{x}/{-y}.png"}, ///geoserver/gwc/service/tms/1.0.0/ne:newcastle_vnc@WebMercatorQuad@png/{z}/{x}/{-y}.png
    {id: "sydney_vnc", name: "Sydney VNC", url: ""},
    {id: "brisbane_vnc", name: "Brisbane VNC", url: ""},
    {id: "rockhampton_vnc", name: "Rockhampton VNC", url: ""},
    {id: "perth_vnc", name: "Perth VNC", url: ""}
];

//Edit this to add you own charts
const airpotCharts = [
    {id: "williamtown", name: "Williamtown (YWLM)", url: ""} 
];

//Styling
const labelFont = 'Arial';
const labelSize =  1;
const labelColor = new ol.style.Fill({ color: 'white' });
const bgFill = new ol.style.Fill({ color: 'rgba(0, 0, 0, 0.6)' });
const routeWidth = 5;
const activeRouteWidth = 7;
const routeColor = 'black';
const activeRouteColor = '#FD3DB5';
const pointColor = new ol.style.Fill({ color: routeColor });
const pointStroke = 2;
const pointRadius = 6;
const backgroundColour = '#262626';
const foregroundColour = '#313131';
const blueColour = '#0066cc';
const purpleColour = '#6600cc';
const greenColour = '#00cc22';
const amberColour = '#cc9900';
const redColour = '#cc0000';
const darkGreenColour = '#00400b';
const mainButtonSize = 1.5;
const overlayButtonSize = 1.25;2