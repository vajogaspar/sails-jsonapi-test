var pluralize = require('pluralize');
var JsonApiService = require('./services/JsonApiService');
var responseOk = require('./responses/ok');
var responseInvalidJsonApi = require('./responses/invalidJsonApi');
var responseNegotiate = require('./responses/negotiate');
var responseBadRequest = require('./responses/badRequest');
var responseForbidden = require('./responses/forbidden');
var responseInvalid = require('./responses/invalid');
var responseNotFound = require('./responses/notFound');
var responseServerError = require('./responses/serverError');

var addToRelationship = require('./actions/addToRelationship');
var removeFromRelationship = require('./actions/removeFromRelationship');
var replaceRelationship = require('./actions/replaceRelationship');
var populateAction = require('./actions/populate');

module.exports = function (sails) {

  // Declare a var that will act as a reference to this hook.
  var hook;

  return {

    defaults: {
      'my-jsonapi': {
        caseSerialized: 'kebab-case',
        caseDeserialized: 'camelCase',
      },
    },

    configure: function() {
      sails.config.blueprints.pluralize = true;

      sails.services.JsonApiService = JsonApiService;
    },

    initialize: function(cb) {
      // Assign this hook object to the `hook` var.
      // This allows us to add/modify values that users of the hook can retrieve.
      hook = this;

      // Initialize a couple of values on the hook.

      sails.after(['hook:blueprints:loaded', 'hook:responses:loaded'], function() {
        var prefix = sails.config.blueprints.prefix;
        if ( !prefix.match(/^\//) ) {
          prefix = `/${prefix}`;
        }

        sails.config[hook.configKey].prefix = prefix;
        sails.services.JsonApiService.init(sails.config[hook.configKey]);

        //console.log(prefix);
        console.log('my-jsonapi: registering routes');

        const actions = sails.getActions();
        for (let name in sails.models) {

          let model = sails.models[name];
          let identity = pluralize(model.identity);

          hook.routes.before[`POST ${prefix}/${identity}`] = function(req, res, next) {
            if (JsonApiService.validate(req.body, JsonApiService.CONTEXT_CREATE) === false) {
              return res.invalidJsonApi();
            }

            req.body = JsonApiService.deserialize(identity, req.body);
            return next();
          };

          hook.routes.before[`PATCH ${prefix}/${identity}/:id`] = function(req, res, next) {
            if (JsonApiService.validate(req.body, JsonApiService.CONTEXT_UPDATE) === false) {
              return res.invalidJsonApi();
            }

            req.body = JsonApiService.deserialize(identity, req.body);
            return next();
          };

          model.associations.forEach((association) => {
            let alias = association['alias'];
            let type = association[association['type']];

            sails.log.verbose(`${name} has a relation with ${type} (as ${alias})`);
            hook.routes.before[`GET ${prefix}/${identity}/:parentid/relationships/${alias}`] = function(req, res) {
              const parentid = req.param('parentid');

              if (association['type'] !== 'model'){
                req.params.select = 'id';
              }

              Object.assign(req.options, { action: `${name}/populate`, alias: alias, model: name, associations: _.cloneDeep(model.associations), autoWatch: sails.config.blueprints.autoWatch  });
              req.options.extractRelationship = {
                alias,
                type: association['type'],
                self: `${prefix}/${identity}/${parentid}/relationships/${alias}`,
                related: `${prefix}/${identity}/${parentid}/${alias}`,
              };

              return populateAction(req, res);
              // return actions[`${name}/populate`](req, res);
            };

            hook.routes.before[`PATCH ${prefix}/${identity}/:parentid/relationships/${alias}`] = function(req, res) {
              const parentid = req.param('parentid');

              if (association['type'] === 'model') {
                req.params.select = 'id';
                req.params.id = parentid;
                const relatedId = JsonApiService.deserializeRelationship(req.body, association);
                req.body = {};
                req.body[alias] = relatedId;

                Object.assign(req.options, {
                  action: `${name}/update`,
                  alias: identity,
                  model: name,
                  associations: _.cloneDeep(model.associations),
                  autoWatch: sails.config.blueprints.autoWatch
                });

                req.options.extractRelationship = {
                  alias,
                  type: association['type'],
                  self: `${prefix}/${identity}/${parentid}/relationships/${alias}`,
                  related: `${prefix}/${identity}/${parentid}/${alias}`,
                  fromModel: true
                };

                //handle with default blueprint action
                return actions[`${name}/update`](req, res);
              } else {
                Object.assign(req.options, {
                  action: `${name}/replace`,
                  alias: alias,
                  model: name,
                  associations: _.cloneDeep(model.associations),
                  autoWatch: sails.config.blueprints.autoWatch
                });

                req.options.extractRelationship = {
                  alias,
                  type: association['type'],
                  self: `${prefix}/${identity}/${parentid}/relationships/${alias}`,
                  related: `${prefix}/${identity}/${parentid}/${alias}`,
                };

                req.body = JsonApiService.deserializeRelationship(req.body, req.options.extractRelationship);

                return replaceRelationship(req, res);
              }
            };

            hook.routes.before[`POST ${prefix}/${identity}/:parentid/relationships/${alias}`] = function(req, res) {
              const parentid = req.param('parentid');

              if (association['type'] === 'model'){
                return res.invalidJsonApi();
              }

              Object.assign(req.options, { action: `${name}/add`, alias: alias, model: name, associations: _.cloneDeep(model.associations), autoWatch: sails.config.blueprints.autoWatch  });
              req.options.extractRelationship = {
                alias,
                type: association['type'],
                self: `${prefix}/${identity}/${parentid}/relationships/${alias}`,
                related: `${prefix}/${identity}/${parentid}/${alias}`,
              };

              req.body = JsonApiService.deserializeRelationship(req.body, req.options.extractRelationship);

              return addToRelationship(req, res);
            };

            hook.routes.before[`DELETE ${prefix}/${identity}/:parentid/relationships/${alias}`] = function(req, res) {
              const parentid = req.param('parentid');

              if (association['type'] === 'model'){
                return res.invalidJsonApi();
              }

              Object.assign(req.options, { action: `${name}/remove`, alias: alias, model: name, associations: _.cloneDeep(model.associations), autoWatch: sails.config.blueprints.autoWatch  });
              req.options.extractRelationship = {
                alias,
                type: association['type'],
                self: `${prefix}/${identity}/${parentid}/relationships/${alias}`,
                related: `${prefix}/${identity}/${parentid}/${alias}`,
              };

              req.body = JsonApiService.deserializeRelationship(req.body, req.options.extractRelationship);

              return removeFromRelationship(req, res);
            };


            // hook.routes.after[`GET ${prefix}/${identity}/:parentid/relationships/${alias}`] = function(req, res, next) {
            //   console.log(`GET ${prefix}/${identity}/:parentid/relationships/${alias} - my-jsonapi::after`);
            //   //req.options.model = type;
            //   //req.options.extractRelationship = alias;
            //
            //   return next();
            // };

            // hook.routes.after[`GET ${prefix}/${identity}/:parentid/${alias}`] = function(req, res, next) {
            //   req.options.model = type;
            //   return next();
            // };

          });
        };

        sails.hooks.responses.middleware.ok = responseOk;
        sails.hooks.responses.middleware.negotiate = responseNegotiate;
        sails.hooks.responses.middleware.invalidJsonApi = responseInvalidJsonApi;
        sails.hooks.responses.middleware.badRequest = responseBadRequest;
        sails.hooks.responses.middleware.invalid = responseInvalid;
        sails.hooks.responses.middleware.notFound = responseNotFound;
        sails.hooks.responses.middleware.serverError = responseServerError;
        sails.hooks.responses.middleware.forbidden = responseForbidden;

      });


      // Signal that initialization of this hook is complete
      // by calling the callback.
      return cb();
    },

    routes: {

      before: {
      },

      after: {

      }

    }
  };
};
