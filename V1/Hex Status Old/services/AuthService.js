const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Admin } = require('../models');

class AuthService {
    static JWT_SECRET = process.env.JWT_SECRET || '4Od!MwUh3lbU7kTJPqeocffWbtM75#1e01#6xS5y75ICk5^dKMefV5kmuvMj5FJ!^@n97A4Mcu9c@HDc';

    static async validateCredentials(username, password) {
        const admin = await Admin.findOne({ username });
        if (!admin) return false;
        return await bcrypt.compare(password, admin.password);
    }

    static generateToken(adminId) {
        return jwt.sign({ id: adminId }, this.JWT_SECRET, { expiresIn: '7d' });
    }

    static async verifyToken(token) {
        try {
            const decoded = jwt.verify(token, this.JWT_SECRET);
            const admin = await Admin.findById(decoded.id);
            return admin ? decoded : false;
        } catch (error) {
            return false;
        }
    }

    static async hashPassword(password) {
        return await bcrypt.hash(password, 10);
    }
}

module.exports = { AuthService };
