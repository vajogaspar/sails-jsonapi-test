/**
 * User.js
 *
 * @description :: A model definition.  Represents a database table/collection/etc.
 * @docs        :: https://sailsjs.com/docs/concepts/models-and-orm/models
 */

module.exports = {

  schema: true,

  attributes: {
    email: { type: 'string', required: true, },
    firstName: { type: 'string', required: true, },
    lastName: { type: 'string', required: true, },
    createdAt: { type: 'string', autoCreatedAt: true, },
    updatedAt: { type: 'string', autoUpdatedAt: true, },
    photos: {
      collection: 'photo',
      via: 'user'
    }
  },

};
