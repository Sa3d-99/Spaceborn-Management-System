const createPgModel = require('./createPgModel');

const Model = createPgModel('tasks', { patchOnSave: true });

module.exports = Model;
