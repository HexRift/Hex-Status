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

    const defaultTheme = {
        primary: '#ff0000',
        secondary: '#1a1a1a',
        accent: '#ff3333',
        background: '#0a0a0a',
        text: '#ffffff',
        cardBg: '#1f1f1f',
        hover: '#ff1a1a'
    };

    res.render('index', {
        settings,
        services,
        serviceHistory,
        config: {
            theme: settings?.theme || defaultTheme,
            Site: {
                name: settings?.site?.name || 'Hex Status',
                description: settings?.site?.description || 'Service Status Monitor',
                footer: settings?.site?.footer || 'Hex Status'
            }
        },
        title: settings?.site?.name || 'Hex Status'
    });
});

module.exports = router;
