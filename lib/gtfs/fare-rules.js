const FareRule = require('../../models/fare-rule');

/*
 * Returns fare_rules for the agencyKey and routeId specified
 */
exports.getFareRulesByRouteId = (agencyKey, routeId, cb) => {
  return FareRule.find({
    agency_key: agencyKey,
    route_id: routeId
  }).exec(cb);
};
