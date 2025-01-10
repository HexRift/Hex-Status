const { AuthService } = require('../services/AuthService');

async function adminAuth(req, res, next) {
    try {
        const token = req.cookies.adminToken;
        if (!token) return res.redirect('/admin/login');

        const decoded = await AuthService.verifyToken(token);
        if (!decoded) return res.redirect('/admin/login');

        req.admin = decoded;
        next();
    } catch (err) {
        res.redirect('/admin/login');
    }
}

module.exports = adminAuth;
