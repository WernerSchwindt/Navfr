"use strict";

function SectorObject(endPoint)
{
	this.sectorName = "N/A";
	this.endPoint = endPoint;
	this.latlong = ol.proj.toLonLat(endPoint);	
	this.bearing = null;
	this.distance = null;
	this.ias = null;
	this.altitude = null;
	this.windDir = null;
	this.windSpd = null;
	this.groundSpeed = null;
	this.heading = null;
	this.ete = [];
}

SectorObject.prototype.setNull = function()
{
	this.sectorName = null;
	this.endPoint = null;
	this.latlong = null;
	this.bearing = null;
	this.distance = null;
	this.ias = null;
	this.altitude = null;
	this.windDir = null;
	this.windSpd = null;
	this.groundSpeed = null;
	this.heading = null;
	this.ete = null;
}

function greatCircleDistance(startLatLong, finishLatLong)
{
	const R = 3440.0695; // Earth's radius in nautical miles

	const lat1Rad = toRadians(startLatLong[1]);
	const lon1Rad = toRadians(startLatLong[0]);
	const lat2Rad = toRadians(finishLatLong[1]);
	const lon2Rad = toRadians(finishLatLong[0]);

	const dlon = toRadians(finishLatLong[0] - startLatLong[0]);

	const centralAngle = Math.acos(
		Math.sin(lat1Rad) * Math.sin(lat2Rad) + Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dlon)
	);

	return R * centralAngle;
}

function calculateBearing(startLatLong, finishLatLong)
{
	 // Convert latitude and longitude from degrees to radians
	const lat1Rad = toRadians(startLatLong[1]);
	const lon1Rad = toRadians(startLatLong[0]);
	const lat2Rad = toRadians(finishLatLong[1]);
	const lon2Rad = toRadians(finishLatLong[0]);

	// Calculate the bearing using the formula
	const y = Math.sin(lon2Rad - lon1Rad) * Math.cos(lat2Rad);
	const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(lon2Rad - lon1Rad);
	const bearingRad = Math.atan2(y, x);

	return toDegrees(bearingRad) + 360;
}

function getMagVar(startLatLong, finishLatLong, isMid)
{
	// Calculate mag var
	if(isMid)
	{
		const midPoint = calculateMidPoint(startLatLong, finishLatLong);
		return geoMag(midPoint[1], midPoint[0]).dec;
	}
	else
	{
		return geoMag(finishLatLong[1], finishLatLong[0]).dec;
	}
}

SectorObject.prototype.setName = function(name)
{
	this.sectorName = "WP" + name;
}

SectorObject.prototype.calculateWindCorrection = function()
{
	if(this.ias == null || this.windSpd == null || this.windDir == null)
	{
		return;
	}
	
	// Convert angles to radians
	const windDirRad = toRadians(this.windDir);
	const crsRad = toRadians(this.bearing);

	// Calculate the crosswind
	const crosswind = this.windSpd * Math.sin(windDirRad - crsRad);
	const headwind = this.windSpd * Math.cos(windDirRad - crsRad);

	// Calculate the drift angle and ground speed
	const driftAngle = Math.asin(crosswind / this.ias);
	this.groundSpeed = (this.ias * Math.cos(driftAngle)) - headwind;

	// Convert back to degrees and normalize to 0-360 range
	this.heading = toDegrees(crsRad + driftAngle) % 360;
	
	// Calculate sector ete
	if(this.groundSpeed > 30)
	{
		const hours = this.distance / this.groundSpeed;
		this.ete = [Math.floor(hours), (hours - Math.floor(hours)) * 60];
	}
}

function calculateMidPoint(startLatLog, endLatLong)
{
	const dLon = toRadians(endLatLong[0] - startLatLog[0]);

    //convert to radians
    const lat1 = toRadians(startLatLog[1]);
    const lat2 = toRadians(endLatLong[1]);
    const lon1 = toRadians(startLatLog[0]);

    const Bx = Math.cos(lat2) * Math.cos(dLon);
    const By = Math.cos(lat2) * Math.sin(dLon);
    const lat3 = toDegrees(Math.atan2(Math.sin(lat1) + Math.sin(lat2), Math.sqrt((Math.cos(lat1) + Bx) * (Math.cos(lat1) + Bx) + By * By)));
    const lon3 = toDegrees(lon1 + Math.atan2(By, Math.cos(lat1) + Bx));
	
	return [lon3, lat3];
}

function toRadians(degrees) 
{
	return degrees * Math.PI / 180;
}

function toDegrees(radians)
{
	return radians * 180 / Math.PI;
}