const _ = require('lodash');

const Agency = require('../../models/agency');
const Route = require('../../models/route');
const Shape = require('../../models/shape');
const Trip = require('../../models/trip');

function coordsToString(point1, point2) {
  return `${point1[0]},${point1[1]},${point2[0]},${point2[1]}`;
}

function consolidateShapes(shapes) {
  const coordKeys = {};
  const lineStrings = shapes.map(shape => shape.map(point => point.loc));
  let count = 0;
  while (count < lineStrings.length) {
    lineStrings[count].forEach((point, idx) => {
      if (idx < lineStrings[count].length - 1) {
        const key = coordsToString(point, lineStrings[count][idx + 1]);
        if (coordKeys[key]) {
          lineStrings.push(lineStrings[count].splice(idx + 1));
          lineStrings[count].pop();
        } else {
          coordKeys[key] = true;
        }
      }
    });
    count++;
  }

  // Remove lineStrings with no length or with only one point
  return _.filter(lineStrings, lineString => lineString.length > 1);
}

function shapesToGeoJSON(shapes, properties = {}) {
  const lineStrings = consolidateShapes(shapes);

  return {
    type: 'FeatureCollection',
    features: lineStrings.map(lineString => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: lineString
      },
      properties
    }))
  };
}

/*
 * Returns an array of shapes for the `agencyKey` specified
 */
exports.getShapes = (agencyKey, cb) => {
  return Trip.find({agency_key: agencyKey}).distinct('shape_id')
  .then(shapeIds => _.compact(shapeIds))
  .then(shapeIds => exports.getShapesByShapeId(agencyKey, shapeIds))
  .then(shapes => {
    if (cb) {
      cb(null, shapes);
    }

    return shapes;
  })
  .catch(cb);
};

/*
 * Returns geoJSON of the shapes for the `agencyKey`specified
 */
exports.getShapesAsGeoJSON = (agencyKey, cb) => {
  const properties = {};
  return Agency.findOne({
    agency_key: agencyKey
  })
  .then(agency => {
    properties.agency_name = agency.agency_name;
    properties.agency_key = agency.agency_key;

    return exports.getShapes(agencyKey);
  })
  .then(shapes => shapesToGeoJSON(shapes, properties))
  .then(geojson => {
    if (cb) {
      cb(null, geojson);
    }

    return geojson;
  })
  .catch(cb);
};

/*
 * Returns an array of shapes for the `agencyKey`, `routeId` and
 * `directionId` specified
 */
exports.getShapesByRoute = (agencyKey, routeId, directionId, serviceIds, cb) => {
  if (_.isFunction(directionId)) {
    cb = directionId;
    directionId = undefined;
    serviceIds = undefined;
  }

  if (_.isFunction(serviceIds)) {
    cb = serviceIds;
    serviceIds = undefined;
  }

  return exports.getShapeIdsByRoute(agencyKey, routeId, directionId, serviceIds)
  .then(shapeIds => _.compact(shapeIds))
  .then(shapeIds => exports.getShapesByShapeId(agencyKey, shapeIds))
  .then(shapes => {
    if (cb) {
      cb(null, shapes);
    }

    return shapes;
  })
  .catch(cb);
};

/*
 * Returns geoJSON of the shapes for the `agencyKey`, `routeId` and
 * `directionId` specified
 */
exports.getShapesByRouteAsGeoJSON = (agencyKey, routeId, directionId, serviceIds, cb) => {
  if (_.isFunction(directionId)) {
    cb = directionId;
    directionId = undefined;
    serviceIds = undefined;
  }

  if (_.isFunction(serviceIds)) {
    cb = serviceIds;
    serviceIds = undefined;
  }

  const properties = {
    direction_id: directionId
  };

  return Route.findOne({
    agency_key: agencyKey,
    route_id: routeId
  }, {_id: 0})
  .then(route => {
    Object.assign(properties, route.toObject());

    return Agency.findOne({
      agency_key: agencyKey
    });
  })
  .then(agency => {
    properties.agency_name = agency.agency_name;
    properties.agency_key = agency.agency_key;

    return exports.getShapesByRoute(agencyKey, routeId, directionId, serviceIds);
  })
  .then(shapes => shapesToGeoJSON(shapes, properties))
  .then(geojson => {
    if (cb) {
      cb(null, geojson);
    }

    return geojson;
  })
  .catch(cb);
};

/*
 * Returns an array of shape_ids for the `agencyKey`, `routeId` and
 * `directionId` specified
 */
exports.getShapeIdsByRoute = (agencyKey, routeId, directionId, serviceIds) => {
  const query = {
    agency_key: agencyKey,
    route_id: routeId
  };

  // Use directionId if specified, else match all directionIds
  if (directionId !== undefined) {
    query.direction_id = directionId;
  }

  if (serviceIds && serviceIds.length > 0) {
    query.service_id = {
      $in: serviceIds
    };
  }

  return Trip
    .find(query)
    .distinct('shape_id')
};

/*
 * Returns an array of shapes for the `shape_ids` specified
 */
exports.getShapesByShapeId = (agencyKey, shapeIds) => {
  const shapes = [];

  return Promise.all(shapeIds.map(shapeId => {
    return Shape.find({
      agency_key: agencyKey,
      shape_id: shapeId
    })
    .sort({shape_pt_sequence: 1})
    .then(shapePts => {
      if (!shapePts || shapePts.length === 0) {
        throw (new Error(`No shapes with shape_id ${shapeId}.`));
      }

      shapes.push(shapePts);
    });
  })).then(() => {
    return shapes;
  });
};
