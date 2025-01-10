const router = require('express').Router();
const { Service } = require('../models');

router.get('/', async (req, res) => {
    const services = await Service.find();
    const serviceHistory = {};

    services.forEach(service => {
        serviceHistory[service.name] = {
            status: service.status,
            uptime: service.uptime,
            checks: service.checks,
            responseTime: service.responseTime,
            statusHistory: service.statusHistory
        };
    });

    res.render('index', {
        config: req.app.locals.config,
        services,
        serviceHistory,
        title: req.app.locals.config.Site.name,
        description: req.app.locals.config.Site.description,
        footer: req.app.locals.config.Site.footer,
        github: req.app.locals.config.URLs.github
    });
});

module.exports = router;
