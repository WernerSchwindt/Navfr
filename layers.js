"use strict";

let layers = null;
let OLMap = null;

function createMapLayers() {
	const projection = ol.proj.get('EPSG:3857');
	const projectionExtent = projection.getExtent();
	const size = ol.extent.getWidth(projectionExtent) / 256;
	const resolutions = new Array(19);
	const matrixIds = new Array(19);

	layers = new ol.Collection();

	for (let z = 0; z < 19; ++z) {
		resolutions[z] = size / Math.pow(2, z);
		matrixIds[z] = z;
	}

	maps.forEach((element) => {
		if(!element['layer'] || element['layer'] == "") {
			return;
		};

		const tileGrid = new ol.tilegrid.TileGrid({
          origin: ol.extent.getTopLeft(projectionExtent),
          resolutions: resolutions,
          matrixIds: matrixIds,
		  tileSize: [256, 256],
		  extent: element['extent'],
        })

		layers.push(new ol.layer.TileLayer({
			source: new ol.source.TileSource({
				url: mapService,
				layer: element['layer'],
				matrixSet: gridset,
				format: format,
				style: '',
				wrapX: true,
				tileGrid: tileGrid,
			}),
			name: element['id'],
			title: element['name'],
			type: element['type'],
		}));
	});
}

function initMap() {
	createMapLayers();

	const routeStyle = [{
		filter: ['==', ['geometry-type'], "Point"],
		style: {
			'circle-radius': ['*', pointRadius, ['get', 'scale']],
			'circle-fill-color': routeColor,
			'circle-stroke-color': 'white',
			'circle-stroke-width': ['*', pointStroke, ['get', 'scale']],
			'text-value': ['get', 'name'],
			'text-fill-color': labelColor,
			'text-background-fill-color': bgFill,
			'text-align': 'left',
			'text-baseline': 'bottom',
			'text-font': ['get', 'textFont'],
			'text-offset-x': ['*', 30, ['get', 'scale']],
			'text-offset-y': ['*', 11, ['get', 'scale']],
			'text-padding': ['get', 'textPadding'],
		},
	},
	{
		else: true,
		filter: ['==', ['get', 'isActive'], true],
		style: {
			'stroke-color': activeRouteColor,
			'stroke-width': ['*', activeRouteWidth, ['get', 'scale']],
		},
	},
	{
		else: true,
		style: {
			'stroke-color': routeColor,
			'stroke-width': ['*', routeWidth, ['get', 'scale']],
		}
	}];

	const ownshipStyle = [{
		filter: ['==', ['geometry-type'], "LineString"],
		style: {
			'stroke-color': routeColor,
			'stroke-width': ['*', vectorWidth, ['get', 'scale']],
			'z-index': 1,
		},
	},
	{
		else: true,
		style: {
			'circle-radius': ['*', 153, ['get', 'scale']],
			'circle-stroke-width': ['*', 32, ['get', 'scale']],
			'circle-stroke-color': 'rgba(255,255,255,0.8)',
			'text-value': ['get', 'location'],
			'text-fill-color': labelColor,
			'text-background-fill-color': bgFill,
			'text-align': 'left',
			'text-baseline': 'bottom',
			'text-font': ['get', 'textFont'],
			'text-offset-x': ['get', 'scale'],
			'text-offset-y': ['*', 50, ['get', 'scale']],
			'text-padding': ['get', 'textPadding'],
		}
	},
	{
		filter: ['==', ['geometry-type'], "Point"],
		style: {
			'icon-src': compassSVG,
			'icon-rotate-with-view': true,
			'icon-rotation': ['get', 'magVar'],
			'icon-scale': ['get', 'scale'],
			'z-index': 0,
		}
	},
	{
		filter: ['==', ['geometry-type'], "Point"],
		style: {
			'icon-src': trackBugSVG,
			'icon-rotate-with-view': true,
			'icon-rotation': ['get', 'trackBug'],
			'icon-scale': ['get', 'scale'],
			'z-index': 1,
		}
	},
	{
		filter: ['==', ['geometry-type'], "Point"],
		style: {
			'icon-src': trackSVG,
			'icon-rotate-with-view': true,
			'icon-rotation': ['get', 'track'],
			'icon-scale': ['get', 'scale'],
			'z-index': 2,
		}
	},
	{
		filter: ['==', ['get', 'airborne'], false],
		style: {
			'icon-src': ownshipSVG,
			'icon-rotate-with-view': true,
			'icon-rotation': ['get', 'track'],
			'icon-scale': ['get', 'scale'],
			'z-index': 2,
		}
	},
	{
		filter: ['==', ['get', 'airborne'], true],
		style: {
			'icon-src': ownshipAirborneSVG,
			'icon-rotate-with-view': true,
			'icon-rotation': ['get', 'track'],
			'icon-scale': ['get', 'scale'],
			'z-index': 2,
		}
	}];

	const trafficStyle = [{
		filter: ['==', ['geometry-type'], "LineString"],
		style: {
			'stroke-color': routeColor,
			'stroke-width': ['*', vectorWidth, ['get', 'scale']],
			'z-index': 1,
		},
	},
	{
		else: true,
		style: {

			'circle-radius': ['*', 16, ['get', 'scale']],
			'circle-fill-color': 'rgba(255,255,255,0.8)',
			'text-value': ['get', 'label'],
			'text-fill-color': labelColor,
			'text-background-fill-color': bgFill,
			'text-align': 'center',
			'text-baseline': 'top',
			'text-font': ['get', 'textFont'],
			'text-offset-x': 0,
			'text-offset-y': ['*', 25, ['get', 'scale']],
			'text-padding': ['get', 'textPadding'],
			'z-index': 0,
		}
	},
	{
		filter: ['==', ['get', 'iconType'], 0],
		style: {
			'icon-src': trafficSVG,
			'icon-rotate-with-view': true,
			'icon-rotation': ['get', 'rotate'],
			'icon-scale': ['get', 'scale'],
			'z-index': 2,
		}
	},
	{
		filter: ['==', ['get', 'iconType'], 1],
		style: {
			'icon-src': highTrafficSVG,
			'icon-rotate-with-view': true,
			'icon-rotation': ['get', 'rotate'],
			'icon-scale': ['get', 'scale'],
			'z-index': 2,
		}
	},
	{
		filter: ['==', ['get', 'iconType'], 2],
		style: {
			'icon-src': groundTrafficSVG,
			'icon-rotate-with-view': true,
			'icon-rotation': ['get', 'rotate'],
			'icon-scale': ['get', 'scale'],
			'z-index': 2,
		}
	}];

	const routeLayer = new ol.layer.VectorLayer({
		source: routeSource,
		style: routeStyle,
		updateWhileAnimating: true,
		renderBuffer: 60,
	});

	layers.push(routeLayer);

	const ownshipLayer = new ol.layer.VectorLayer({
		source: ownshipSource,
		style: ownshipStyle,
		updateWhileAnimating: true,
		renderBuffer: 60,
	});

	layers.push(ownshipLayer);

	const trafficLayer = new ol.layer.VectorLayer({
		source: trafficSource,
		style: trafficStyle,
		updateWhileAnimating: true,
		renderBuffer: 60,
	});

	layers.push(trafficLayer);

	OLMap = new ol.Map({
		target: 'map_canvas',
		layers: layers,
		view: new ol.View({
			center: ol.proj.fromLonLat([centerLon, centerLat]),
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