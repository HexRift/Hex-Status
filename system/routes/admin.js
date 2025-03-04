const router = require('express').Router();
const { Admin, Service } = require('../models');
const Settings = require('../models/Settings');
const { AuthService } = require('../services/AuthService');
const adminAuth = require('../middleware/adminAuth');
const express = require('express');

// Add this line to parse JSON bodies
router.use(express.json());
const defaultTheme = {
    primary: '#ff0000',
    secondary: '#1a1a1a',
    accent: '#ff3333',
    background: '#0a0a0a',
    text: '#ffffff',
    cardBg: '#1f1f1f',
    hover: '#ff1a1a'
};

function createConfigFromSettings(settings) {
    return {
        Site: {
            name: settings?.site?.name || 'Hex Status',
            description: settings?.site?.description || 'Service Status Monitor',
            footer: settings?.site?.footer || 'Hex Status'
        },
        URLs: {
            github: settings?.urls?.github || '#',
            thumbnail: settings?.urls?.thumbnail || 'https://hexarion.net/Hex-Status.png'
        },
        theme: settings?.theme || defaultTheme
    };
}
// Update all route handlers to use the config object
router.get('/login', async (req, res) => {
       const settings = await Settings.findOne();
    const config = createConfigFromSettings(settings);
    res.render('login', { settings, config });
});

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const admin = await Admin.findOne({ username });

        if (!admin || !(await AuthService.validateCredentials(username, password))) {
            return res.render('login', {
                config: createConfigFromSettings(settings),
                error: 'Invalid username or password'
            });
        }

        const token = await AuthService.generateToken(admin._id);
        res.cookie('adminToken', token, { httpOnly: true });
        res.redirect('dashboard');
    } catch (error) {
        console.log('Login error:', error);
        res.render('login', {
            config: createConfigFromSettings(settings),
            error: 'An error occurred during login'
        });
    }
});
router.get('/dashboard', adminAuth, async (req, res) => {
       const settings = await Settings.findOne();
    const services = await Service.find();
    
    const config = {
        Site: {
            name: settings?.site?.name || 'Hex Status',
            description: settings?.site?.description || 'Service Status Monitor',
            footer: settings?.site?.footer || 'Hex Status'
        },
        URLs: {
            github: settings?.urls?.github || '#',
            thumbnail: settings?.urls?.thumbnail || 'https://hexarion.net/Hex-Status.png'
        },
  theme: settings?.theme || defaultTheme
    };

    res.render('dashboard', {
        config,
        services,
        admin: req.admin
    });
});
router.post('/settings/site', adminAuth, async (req, res) => {
    try {
        const { siteName, description, theme } = req.body;
           const settings = await Settings.findOne();
        
        // Update site info
        settings.site.name = siteName;
        settings.site.description = description;
        
        // Update theme with all color properties
        settings.theme = {
            primary: theme.primary,
            secondary: theme.secondary,
            accent: theme.accent,
            background: theme.background,
            text: theme.text,
            cardBg: theme.cardBg,
            hover: theme.hover
        };
        
        await settings.save();

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
       const settings = await Settings.findOne();
    const services = await Service.find();
    
    const config = {
        Site: {
            name: settings?.site?.name || 'Hex Status',
            description: settings?.site?.description || 'Service Status Monitor',
            footer: settings?.site?.footer || 'Hex Status'
        },
        URLs: {
            github: settings?.urls?.github || '#',
            thumbnail: settings?.urls?.thumbnail || 'https://hexarion.net/Hex-Status.png'
        },
  theme: settings?.theme || defaultTheme
    };

    res.render('services', {
        config,
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
       const settings = await Settings.findOne();
    const service = await Service.findById(req.params.id);
    res.render('serviceHistory', {
        settings,
        service,
        admin: req.admin
    });
});
router.get('/users', adminAuth, async (req, res) => {
       const settings = await Settings.findOne();
    const users = await Admin.find({}, 'username email createdAt');
    
    const config = createConfigFromSettings(settings);

    res.render('users', {
        config,
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
            password: hashedPassword,
            createdAt: new Date()
        });

        await newAdmin.save();
        
        res.json({ success: true });
    } catch (error) {
        console.error('[Users]'.red, 'Creation error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to add user'
        });
    }
});


router.post('/settings/notifications', adminAuth, async (req, res) => {
    try {
        const { emailNotifications, smsNotifications } = req.body;
        req.app.locals.config.Notifications.email = emailNotifications;
        req.app.locals.config.Notifications.sms = smsNotifications;
    } catch (error) {
        res.status(500).json({ message: 'Failed to update notification settings' });
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
       const settings = await Settings.findOne();
    
    const config = {
        Site: {
            name: settings?.site?.name || 'Hex Status',
            description: settings?.site?.description || 'Service Status Monitor',
            footer: settings?.site?.footer || 'Hex Status'
        },
        URLs: {
            github: settings?.urls?.github || '#',
            thumbnail: settings?.urls?.thumbnail || 'https://hexarion.net/Hex-Status.png'
        },
  theme: settings?.theme || defaultTheme
    };

    res.render('settings', {
        config,
        admin: req.admin
    });
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

router.get('/register', async (req, res) => {
       const settings = await Settings.findOne();
    const existingAdmin = await Admin.findOne({});
    
    const config = {
        Site: {
            name: settings?.site?.name || 'Hex Status',
            description: settings?.site?.description || 'Service Status Monitor',
            footer: settings?.site?.footer || 'Hex Status'
        },
        URLs: {
            github: settings?.urls?.github || '#',
            thumbnail: settings?.urls?.thumbnail || 'https://hexarion.net/Hex-Status.png'
        },
  theme: settings?.theme || defaultTheme
    };

    res.render('register', {
        config,
        error: existingAdmin ? 'An admin account already exists. Registration is disabled.' : null,
        registrationDisabled: !!existingAdmin
    });
});


router.post('/register', async (req, res) => {
    try {
           const settings = await Settings.findOne();
        const existingAdmin = await Admin.findOne({});
        if (existingAdmin) {
            return res.render('register', {
                settings,
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
           const settings = await Settings.findOne();
        res.render('register', {
            settings,
            error: 'Registration failed. Please try again.',
            registrationDisabled: false
        });
    }
});
router.delete('/api/services/:name', async (req, res) => {
    try {
        const result = await Service.deleteOne({ name: req.params.name });
        res.json({ success: result.deletedCount > 0 });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.put('/api/services/update', async (req, res) => {
    try {
        const { name, url, originalName } = req.body;
        const service = await Service.findOneAndUpdate(
            { name: originalName },
            { name, url },
            { new: true }
        );
        
        if (service) {
            res.json({ success: true, service });
        } else {
            res.status(404).json({ success: false, message: 'Service not found' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.put('/services/:name', async (req, res) => {
    try {
        const originalName = req.params.name;
        const { name, url } = req.body;
        
        const updatedService = await Service.findOneAndUpdate(
            { name: originalName },
            { 
                name: name,
                url: url 
            },
            { new: true }
        );
        
        if (!updatedService) {
            return res.status(404).json({ message: 'Service not found' });
        }
        
        res.json({ 
            success: true, 
            service: updatedService 
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

router.put('/api/services/update', async (req, res) => {
    try {
        const { name, url, originalName } = req.body;
        const service = await Service.findOneAndUpdate(
            { name: originalName },
            { name, url },
            { new: true }
        );
        
        if (service) {
            res.json({ success: true, service });
        } else {
            res.status(404).json({ success: false, message: 'Service not found' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});



router.get('/logout', (req, res) => {
    res.clearCookie('adminToken');
    res.redirect('login');
});

module.exports = router;
