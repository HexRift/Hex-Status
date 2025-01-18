const router = require('express').Router();
const mongoose = require('mongoose');
const { Service } = require('../models');
const Settings = require('../models/Settings');

router.get('/', async (req, res) => {
    const settings = await Settings.findOne();
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
        settings,
        services,
        serviceHistory,
        config: {
            theme: settings?.theme || {
                primary: '#ff0000',
                secondary: '#000000',
                accent: '#ff3333',
                background: '#1a1a1a'
            }
        },
        title: settings?.site?.name || 'Hex Status',
        description: settings?.site?.description || 'Service Status Monitor',
        footer: settings?.site?.footer || 'Hex Status',
        github: settings?.urls?.github || '#'
    });
});
module.exports = router;