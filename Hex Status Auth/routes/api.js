const router = require('express').Router();
const { Service } = require('../models');
const { MonitoringService } = require('../services/MonitoringService');
const adminAuth = require('../middleware/adminAuth');

router.get('/services', async (req, res) => {
    try {
        const services = await Service.find();
        res.json(services);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch services' });
    }
});

router.get('/status', async (req, res) => {
    try {
        const services = await Service.find();
        const onlineServices = services.filter(s => s.status);
        const totalUptime = services.reduce((acc, s) => 
            acc + ((s.uptime / Math.max(s.checks, 1)) * 100), 0) / services.length;

        res.json({
            total: services.length,
            online: onlineServices.length,
            uptime: totalUptime.toFixed(2),
            services: services.map(s => ({
                name: s.name,
                status: s.status,
                responseTime: s.responseTime,
                uptime: ((s.uptime / Math.max(s.checks, 1)) * 100).toFixed(2)
            }))
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch status' });
    }
});

// Protected API routes
router.use(adminAuth);

router.post('/services/:name/check', async (req, res) => {
    try {
        const service = await Service.findOne({ name: req.params.name });
        if (!service) return res.status(404).json({ error: 'Service not found' });

        const result = await MonitoringService.checkService(service);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to check service' });
    }
});

module.exports = router;
