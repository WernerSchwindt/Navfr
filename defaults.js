"use strict";

const url = "https://server.eldercodes.net"; //Change this to your server domain.
const mapService = url + "/geoserver/ne/gwc/service/wmts";
const apiData = url + "/navfr/api";
const DisplayUnits = "nautical";
let centerLat = -32.795;
let centerLon = 151.834;
const zoomLvl = 11.42;
const mToNm = 0.000539957;
const transitionAlt = 10000;
const gridset = "WebMercatorQuad";
const format = "image/png";

//Edit this to add your own maps
const maps = [
   /* { id: "sydney_vtc", name: "Sydney VTC", url: "" },
    { id: "tamworth_vtc", name: "Tamworth VTC", url: "" },
    { id: "brisbane_vtc", name: "Brisbane VTC", url: "" },
    { id: "rockhampton_vtc", name: "Rockhampton VTC", url: "" },
    { id: "perth_vtc", name: "Perth VTC", url: "" },*/
    { 
        name: "Base", 
        layer: "ne:coastlines",
        extent: [-20037508.342789244, -20222169.957846258, 20037508.342789244, 18394384.31625568],
        type: "base",
    },
    { 
        name: "Brisbane VNC", 
        layer: "ne:brisbane_vnc",
        extent: [16744224.6467, -3657758.2288, 17150826.9753, -3045912.5675],
        type: "vnc",
    },
    { 
        name: "Newcastle VNC", 
        layer: "ne:newcastle_vnc",
        extent: [16417061.7504, -4024126.3366, 17049246.328, -3600554.1694],
        type: "vnc",
    },
    { 
        name: "Sydney VNC", 
        layer: "ne:sydney_vnc", 
        extent: [16248675.0412, -4353056.785, 16894249.0688, -3930020.7705],
        type: "vnc",
    },
     /* { id: "rockhampton_vnc", name: "Rockhampton VNC", url: "" },
      { id: "perth_vnc", name: "Perth VNC", url: "" }*/
   /* { 
        name: "Wiliantown VTC", 
        layer: "ne:WLM_VTC",
        extent: [],
    },*/
];

//Edit this to add you own charts
const airpotCharts = [
    { id: "williamtown", name: "Williamtown (YWLM)", url: "" }
];

//Styling
const labelFont = 'Arial';
const labelSize = 1;
const labelColor = 'rgb(255, 255, 255)';
const bgFill = 'rgba(0, 0, 0, 0.6)';
const routeWidth = 5;
const activeRouteWidth = 7;
const vectorWidth = 1.5;
const routeColor = 'black';
const activeRouteColor = '#FD3DB5';
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
const overlayButtonSize = 1.25;