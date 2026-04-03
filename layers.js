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

	const dimTile = new ol.layer.VectorLayer({
		title: 'Empty layer',
		source: new ol.source.VectorSource({
			attributions: '© No data'
		})
	});

	dimTile.on('postrender', dim);

	layers.push(dimTile);
}

function initMap() {
	createMapLayers();

	/*const routeStyle = [{
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
		}
	},
	{
		filter: ['all', ['==', ['geometry-type'], "Point"], ['has', 'location']],
		style: {
			'text-value': ['get', 'location'],
			'text-fill-color': labelColor,
			'text-background-fill-color': bgFill,
			'text-align': 'center',
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
		filter: ['all', ['==', ['geometry-type'], "Point"], ['has', 'trackBug']],
		style: {
			'icon-src': trackBugSVG,
			'icon-rotate-with-view': true,
			'icon-rotation': ['get', 'trackBug'],
			'icon-scale': ['get', 'scale'],
			'z-index': 1,
		}
	},
	{
		filter: ['all', ['==', ['geometry-type'], "Point"], ['has', 'windArrow']],
		style: {
			'icon-src': windArrowSVG,
			'icon-rotate-with-view': true,
			'icon-rotation': ['get', 'windArrow'],
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
	}];*/

	const routeLayer = new ol.layer.VectorLayer({
		source: routeSource,
		style: routeStyleFunction, //(simMode) ? routeStyleFunction : routeStyle,
		updateWhileAnimating: true,
		renderBuffer: 60,
	});

	layers.push(routeLayer);

	const ownshipLayer = new ol.layer.VectorLayer({
		source: ownshipSource,
		style: ownshipStyleFunction, //(simMode) ? ownshipStyleFunction : ownshipStyle,
		updateWhileAnimating: true,
		renderBuffer: 60,
	});

	layers.push(ownshipLayer);

	const trafficLayer = new ol.layer.VectorLayer({
		source: trafficSource,
		style: trafficStyleFunction, //(simMode) ? trafficStyleFunction : trafficStyle,
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


/* Dim map */
function dim(evt) {
    try {

		evt.context.globalCompositeOperation = 'multiply';
		evt.context.fillStyle = 'rgba(0,0,0, 0.15)';
		evt.context.fillRect(0, 0, evt.context.canvas.width, evt.context.canvas.height);
		evt.context.globalCompositeOperation = 'source-over';

    } catch (error) {
        console.error(error);
    }
}

function routeStyleFunction(feature, resolution){
	if(feature.getGeometry().getType() == "Point"){
		return new ol.style.Style({
			image: new ol.style.Circle({
				radius: pointRadius * feature.get('scale'),
				fill:  new ol.style.Fill({ color: routeColor}),
				stroke: new ol.style.Stroke({ 
					color: 'white', 
					width: pointStroke * feature.get('scale') 
				}),
			}),
			text: new ol.style.Text({
				text: feature.get('name'),
				fill: new ol.style.Fill({ color: labelColor}),
				backgroundFill: new ol.style.Fill({ color: bgFill}),
				textAlign: 'left',
				textBaseline: 'bottom',
				font: feature.get('textFont'),
				offsetX: 30 * feature.get('scale'),
				offsetY: 11 * feature.get('scale'),
				padding: feature.get('textPadding'),
			}),
		});
	}
	else{
		return new ol.style.Style({
			fill: new ol.style.Fill({ color: labelColor}),
			stroke: new ol.style.Stroke({
				color: (feature.get('isActive')) ? activeRouteColor : routeColor,
				width: activeRouteWidth * feature.get('scale'),
			}),
		});
	}
}

function ownshipStyleFunction(feature, resolution)
{
	if(feature.getGeometry().getType() == "LineString"){
		return new ol.style.Style({
			stroke: new ol.style.Stroke({
				color: routeColor,
				width: vectorWidth * feature.get('scale'),
			}),
			zIndex: 1,
		});
	}
	else{

		let styles = [new ol.style.Style({
			image: new ol.style.Circle({
				radius: 153 * feature.get('scale'),
				stroke: new ol.style.Stroke({ 
					color: 'rgba(255,255,255,0.8)', 
					width: 32 * feature.get('scale') 
				}),
			}),
		}),
		new ol.style.Style({
			image: new ol.style.Icon({
				src: compassSVG,
				rotateWithView: true,
				rotation: feature.get('magVar'),
				scale: feature.get('scale'),
			}),
			zIndex: 0,
		}),
		new ol.style.Style({
			image: new ol.style.Icon({
				src: trackSVG,
				rotateWithView: true,
				rotation: feature.get('track'),
				scale: feature.get('scale'),
			}),
			zIndex: 2,
		}),
		new ol.style.Style({
			image: new ol.style.Icon({
				src: (feature.get('airborne')) ? ownshipAirborneSVG : ownshipSVG,
				rotateWithView: true,
				rotation: feature.get('track'),
				scale: feature.get('scale'),
			}),
			zIndex: 2,
		})];

		if(feature.get('location')){
			styles.push(new ol.style.Style({
				text: new ol.style.Text({
					text: feature.get('location'),
					fill: new ol.style.Fill({ color: labelColor}),
					backgroundFill: new ol.style.Fill({ color: bgFill}),
					textAlign: 'center',
					textBaseline: 'bottom',
					font: feature.get('textFont'),
					offsetX: feature.get('scale'),
					offsetY: 50 * feature.get('scale'),
					padding: feature.get('textPadding'),
				}),
			}));
		}

		if(feature.get('trackBug')){
			styles.push(new ol.style.Style({
				image: new ol.style.Icon({
					src: trackBugSVG,
					rotateWithView: true,
					rotation: feature.get('trackBug'),
					scale: feature.get('scale'),
				}),
				zIndex: 1,
			}));
		}

		if(feature.get('windArrow')){
			styles.push(new ol.style.Style({
				image: new ol.style.Icon({
					src: windArrowSVG,
					rotateWithView: true,
					rotation: feature.get('windArrow'),
					scale: feature.get('scale'),
				}),
				zIndex: 1,
			}));
		}

		return styles;
	}
}

function trafficStyleFunction(feature, resolution){
	if(feature.getGeometry().getType() == "LineString"){
		return new ol.style.Style({
			stroke: new ol.style.Stroke({
				color: routeColor,
				width: vectorWidth * feature.get('scale'),
			}),
			zIndex: 1,
		});
	}
	else{
		let styles = [new ol.style.Style({
			image: new ol.style.Circle({
				radius: 16 * feature.get('scale'),
				fill: new ol.style.Fill({ color: 'rgba(255,255,255,0.8)'}),
			}),
			text: new ol.style.Text({
				text: feature.get('label'),
				fill: new ol.style.Fill({ color: labelColor}),
				backgroundFill: new ol.style.Fill({ color: bgFill}),
				textAlign: 'center',
				textBaseline: 'top',
				font: feature.get('textFont'),
				offsetX: 0,
				offsetY: 25 * feature.get('scale'),
				padding: feature.get('textPadding'),
			}),
			zIndex: 0,
		})];

		if(feature.get('iconType') == 0){
			styles.push(new ol.style.Style({
				image: new ol.style.Icon({
					src: trafficSVG,
					rotateWithView: true,
					rotation: feature.get('rotate'),
					scale: feature.get('scale'),
				}),
				zIndex: 2,
			}));
		}
		else if(feature.get('iconType') == 1){
			styles.push(new ol.style.Style({
				image: new ol.style.Icon({
					src: highTrafficSVG,
					rotateWithView: true,
					rotation: feature.get('rotate'),
					scale: feature.get('scale'),
				}),
				zIndex: 2,
			}));
		}
		else{
			styles.push(new ol.style.Style({
				image: new ol.style.Icon({
					src: groundTrafficSVG,
					rotateWithView: true,
					rotation: feature.get('rotate'),
					scale: feature.get('scale'),
				}),
				zIndex: 2,
			}));
		}

		return styles;
	}
}