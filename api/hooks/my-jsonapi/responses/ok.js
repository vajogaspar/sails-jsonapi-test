var pluralize = require('pluralize');

module.exports = function jsonapiOk(data) {
  // Get access to `req`, `res`, & `sails`
  var req = this.req;
  var res = this.res;
  var sails = req._sails;
  var type = pluralize(req.options.alias || req.options.model);

  data = JsonApiService.serialize(type, data);

  if (req.options.extractRelationship) {
    data = JsonApiService.serializeRelationship(
      req.options.extractRelationship.fromModel ?
      data.data.relationships[req.options.extractRelationship['alias']] :
      data,
      req.options.extractRelationship);
  }
  res.set('Content-Type', 'application/vnd.api+json');

  sails.log.silly('res.ok() :: Sending 200 ("OK") response');

  // If no data was provided, use res.sendStatus().
  if (_.isUndefined(data)) {
    return res.sendStatus(200);
  }
  if (_.isError(data)) {
    if (!_.isFunction(data.toJSON)) {
      if (process.env.NODE_ENV === 'production') {
        return res.sendStatus(200);
      }
      // No need to JSON stringify (it's already a string).
      return res.send(util.inspect(data));
    }
  }
  return res.json(data);

};
