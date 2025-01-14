const express = require('express');
const adminRoutes = require('./admin');
const apiRoutes = require('./api');
const publicRoutes = require('./public');
const cookieParser = require('cookie-parser');

function setupRoutes(app) {
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.use(express.static('public'));
    app.set('view engine', 'ejs');

    // Mount routes
    app.use('/', publicRoutes);
    app.use('/', adminRoutes);
    app.use('/api', apiRoutes);
}

module.exports = { setupRoutes };
