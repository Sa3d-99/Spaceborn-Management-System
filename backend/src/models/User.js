const { randomUUID } = require('node:crypto');
const { hashPassword, verifyPassword, passwordHashAlgorithm } = require('../utils/passwords');
const jwt = require('jsonwebtoken');
const createPgModel = require('./createPgModel');
const { getJwtSecret } = require('../utils/jwtSecret');
const { allocateEmployeeIds } = require('../utils/employeeIds');

const UserModel = createPgModel('users', {
  patchOnSave: true,
  methods: {
    async comparePassword(enteredPassword) {
      return verifyPassword(enteredPassword, this.password, this.passwordAlgorithm);
    },
    toJSON() {
      const { password, ...publicUser } = this;
      return publicUser;
    },
    getSignedJwtToken() {
      return jwt.sign(
        { id: this._id, role: this.role, employeeId: this.employeeId, pv: this.passwordVersion },
        getJwtSecret(),
        { expiresIn: process.env.JWT_EXPIRE || '24h' }
      );
    }
  },
  statics: {
    async generateEmployeeId(role) {
      const [employeeId] = await allocateEmployeeIds(role);
      return employeeId;
    }
  },
  preSave: [
    async function(previous) {
      if (!this.fullName && (this.firstName || this.lastName)) {
        this.fullName = `${this.firstName || ''} ${this.lastName || ''}`.trim();
      }
      if (this.password && this.password !== previous?.password) {
        this.passwordAlgorithm = passwordHashAlgorithm(this.password);
        this.password = await hashPassword(this.password);
        this.passwordVersion = randomUUID();
        this.passwordChangedAt = Date.now();
      }
      if (this.isActive === undefined) this.isActive = true;
      if (this.isOnline === undefined) this.isOnline = false;
      if (!this.role) this.role = 'Member';
      if (!this.department && !this.signupDepartment) this.department = 'Core Systems';
    }
  ]
});

module.exports = UserModel;
