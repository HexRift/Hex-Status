const { AuthService } = require('../services/AuthService');

async function adminAuth(req, res, next) {
    try {
        const token = req.cookies.adminToken;
        if (!token) return res.redirect('/login');

        const decoded = await AuthService.verifyToken(token);
        if (!decoded) return res.redirect('/login');

        req.admin = decoded;
        next();
    } catch (err) {
        res.redirect('/login');
    }
}

module.exports = adminAuth;
