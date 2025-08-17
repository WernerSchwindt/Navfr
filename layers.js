"use strict";

function createBaseLayers() {
	let layers = new ol.Collection();
	let layers_group = new ol.layer.Group({
		layers: layers,
	});
	let vfrCharts = new ol.Collection();

	/*vfrCharts.push(new ol.layer.Tile({
		source: new ol.source.XYZ({
			"url": url + '/geoserver/gwc/service/tms/1.0.0/ne:world@EPSG:900913@png/{z}/{x}/{-y}.png',
			maxZoom: 20,
			transition: 0,
		}),
		name: 'aus_vfr_maps',
		title: 'Aus VFR Maps',
		type: 'base',
	}));*/

	maps.forEach((element) => {
		if(!element['url'] || element['url'] == "") {
			return;
		};

		vfrCharts.push(new ol.layer.TileLayer({
			source: new ol.source.TileSource({
				"url": url + element['url'],
				maxZoom: 20,
				transition: 0,
			}),
			name: element['id'],
			title: element['name'],
			type: 'base',
		}));
	});

	/*aus.push(new ol.layer.Tile({
		source: new ol.source.OSM({
			maxZoom: 17,
			attributionsCollapsible: false,
			transition: 0,
		}),
		name: 'osm',
		title: 'OpenStreetMap',
		type: 'base',
	}));*/

	layers.push(new ol.layer.Group({
		name: 'vfr_charts',
		title: 'VFR Charts',
		layers: new ol.Collection(vfrCharts.getArray().reverse()),
		fold: 'open',
	}));

	return layers_group;
}