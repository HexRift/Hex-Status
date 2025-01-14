const router = require('express').Router();
const { Admin, Service } = require('../models');
const { AuthService } = require('../services/AuthService');
const adminAuth = require('../middleware/adminAuth');
const yaml = require('js-yaml');
const fs = require('fs');

// Change these routes
router.get('/login', (req, res) => {
    res.render('login', { config: req.app.locals.config });
});

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const admin = await Admin.findOne({ username });

        if (!admin || !(await AuthService.validateCredentials(username, password))) {
            return res.render('login', {
                config: req.app.locals.config,
                error: 'Invalid username or password'
            });
        }

        const token = AuthService.generateToken(admin._id);
        res.cookie('adminToken', token, { httpOnly: true });
        res.redirect('dashboard');
    } catch (error) {
        res.render('login', {
            config: req.app.locals.config,
            error: 'An error occurred during login'
        });
    }
});

router.get('/dashboard', adminAuth, async (req, res) => {
    const services = await Service.find();
    res.render('dashboard', {
        config: req.app.locals.config,
        services,
        admin: req.admin
    });
});


router.post('/settings/site', adminAuth, async (req, res) => {
    try {
        const { siteName, description, themeColor } = req.body;
        
        // Get config from app locals
        const config = req.app.locals.config;
        
        // Update config object
        config.Site.name = siteName;
        config.Site.description = description;
        config.theme.primary = themeColor;
        

        // Save to config file
        fs.writeFileSync('config.yml', yaml.dump(config), 'utf8');

        // Send success response
        res.json({ 
            success: true,
            message: 'Site settings updated successfully'
        });
    } catch (error) {
        console.error('[Settings]'.red, 'Site update error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to update site settings'
        });
    }
});


// Service management routes
router.post('/services/add', adminAuth, async (req, res) => {
    try {
        const { name, url } = req.body;
        const newService = new Service({
            name,
            url,
            status: false,
            uptime: 0,
            checks: 0,
            statusHistory: []
        });
        await newService.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Failed to add service' });
    }
});

router.get('/services', adminAuth, async (req, res) => {
    const services = await Service.find();
    res.render('services', {
        config: req.app.locals.config,
        services,
        admin: req.admin
    });
});
router.post('/services/delete/:id', adminAuth, async (req, res) => {
    try {
        await Service.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete service' });
    }
});

router.post('/services/edit/:id', adminAuth, async (req, res) => {
    try {
        const { name, url } = req.body;
        await Service.findByIdAndUpdate(req.params.id, { name, url });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update service' });
    }
});

router.get('/services/history/:id', adminAuth, async (req, res) => {
    const service = await Service.findById(req.params.id);
    res.render('serviceHistory', {
        config: req.app.locals.config,
        service,
        admin: req.admin
    });
});

router.put('/services/:name', adminAuth, async (req, res) => {
    try {
        const { name } = req.params;
        const { url } = req.body;
        await Service.findOneAndUpdate({ name }, { url });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update service' });
    }
});

router.get('/users', adminAuth, async (req, res) => {
    const users = await Admin.find({}, 'username email createdAt');
    res.render('users', {
        config: req.app.locals.config,
        users,
        admin: req.admin
    });
});

router.post('/users/add', adminAuth, async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const hashedPassword = await AuthService.hashPassword(password);
        const newAdmin = new Admin({
            username,
            email,
            password: hashedPassword
        });
        await newAdmin.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Failed to add user' });
    }
});

router.post('/users/delete/:id', adminAuth, async (req, res) => {
    try {
        await Admin.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete user' });
    }
});

router.get('/logout', (req, res) => {
    res.clearCookie('adminToken');
    res.redirect('login');
});


router.get('/users', adminAuth, async (req, res) => {
    const users = await Admin.find({}, 'username email createdAt');
    res.render('users', {
        config: req.app.locals.config,
        users,
        admin: req.admin
    });
});

// Add user management endpoints
router.post('/users/add', adminAuth, async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const hashedPassword = await AuthService.hashPassword(password);
        const newAdmin = new Admin({
            username,
            email,
            password: hashedPassword
        });
        await newAdmin.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Failed to add user' });
    }
});

router.put('/users/:id', adminAuth, async (req, res) => {
    try {
        const { username, email, newPassword } = req.body;
        const updateData = { username, email };
        if (newPassword) {
            updateData.password = await AuthService.hashPassword(newPassword);
        }
        await Admin.findByIdAndUpdate(req.params.id, updateData);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update user' });
    }
});

router.delete('/users/:id', adminAuth, async (req, res) => {
    try {
        await Admin.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete user' });
    }
});

router.get('/settings', adminAuth, async (req, res) => {
    res.render('settings', {
        config: req.app.locals.config,
        admin: req.admin
    });
});

function deleteService(serviceName) {
    if (confirm(`Are you sure you want to delete ${serviceName}?`)) {
        fetch(`services/${serviceName}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                location.reload();
            }
        });
    }
}
router.post('/settings/site', adminAuth, async (req, res) => {
    try {
        const { siteName, description, themeColor } = req.body;
        req.app.locals.config.Site.name = siteName;
        req.app.locals.config.Site.description = description;
        req.app.locals.config.Site.themeColor = themeColor;
        await req.app.locals.config.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update site settings' });
    }
});

router.post('/settings/account', adminAuth, async (req, res) => {
    try {
        const { username, email, newPassword } = req.body;
        const updateData = { username, email };
        if (newPassword) {
            updateData.password = await AuthService.hashPassword(newPassword);
        }
        await Admin.findByIdAndUpdate(req.admin._id, updateData);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update account' });
    }
});

router.post('/settings/site', adminAuth, async (req, res) => {
    try {
        const { siteName, description, themeColor } = req.body;
        req.app.locals.config.Site.name = siteName;
        req.app.locals.config.Site.description = description;
        req.app.locals.config.Site.themeColor = themeColor;
        await req.app.locals.config.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update site settings' });
    }
});

router.delete('/services/:name', adminAuth, async (req, res) => {
    try {
        const { name } = req.params;
        await Service.deleteOne({ name });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete service' });
    }
});

router.post('/settings/site', adminAuth, async (req, res) => {
    try {
        const { siteName, description, themeColor } = req.body;
        req.app.locals.config.Site.name = siteName;
        req.app.locals.config.Site.description = description;
        req.app.locals.config.Site.themeColor = themeColor;
        await req.app.locals.config.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update site settings' });
    }
});

router.get('/register', async (req, res) => {
    // Check if any admin account exists
    const existingAdmin = await Admin.findOne({});
    if (existingAdmin) {
        res.render('register', {
            config: req.app.locals.config,
            error: 'An admin account already exists. Registration is disabled.',
            registrationDisabled: true
        });
    } else {
        res.render('register', {
            config: req.app.locals.config,
            error: null,
            registrationDisabled: false
        });
    }
});

router.post('/register', async (req, res) => {
    try {
        const existingAdmin = await Admin.findOne({});
        if (existingAdmin) {
            return res.render('register', {
                config: req.app.locals.config,
                error: 'Registration is disabled. An admin account already exists.',
                registrationDisabled: true
            });
        }

        const { username, email, password } = req.body;
        const hashedPassword = await AuthService.hashPassword(password);
        const admin = new Admin({
            username,
            email,
            password: hashedPassword
        });

        await admin.save();
        res.redirect('login');
    } catch (error) {
        res.render('register', {
            config: req.app.locals.config,
            error: 'Registration failed. Please try again.',
            registrationDisabled: false
        });
    }
});

router.post('/settings/account', adminAuth, async (req, res) => {
    try {
        const { username, email, newPassword } = req.body;
        const updateData = { username, email };
        if (newPassword) {
            updateData.password = await AuthService.hashPassword(newPassword);
        }
        await Admin.findByIdAndUpdate(req.admin._id, updateData);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update account' });
    }
});


// Settings update endpoints
router.post('/settings/account', adminAuth, async (req, res) => {
    try {
        const { username, email, newPassword } = req.body;
        const updateData = { username, email };

        if (newPassword) {
            updateData.password = await AuthService.hashPassword(newPassword);
        }

        await Admin.findByIdAndUpdate(req.admin._id, updateData);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update account' });
    }
});

router.post('/settings/site', adminAuth, async (req, res) => {
    try {
        const { siteName, description, themeColor } = req.body;
        req.app.locals.config.Site.name = siteName;
        req.app.locals.config.Site.description = description;
        req.app.locals.config.theme.primary = themeColor;

        fs.writeFileSync('config.yml', yaml.dump(req.app.locals.config));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update site settings' });
    }
});

router.post('/settings/notifications', adminAuth, async (req, res) => {
    try {
        const { emailNotifications, smsNotifications } = req.body;
        req.app.locals.config.Notifications.email = emailNotifications;
        req.app.locals.config.Notifications.sms = smsNotifications;
    }
        catch (error) {
        res.status(500).json({ message: 'Failed to update notification settings' });
    }
});


module.exports = router;
