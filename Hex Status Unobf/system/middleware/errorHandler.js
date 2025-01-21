const Settings = require('../models/Settings');

async function errorHandler(err, req, res, next) {
    console.error('[Error]'.red, err.stack);
    
    const settings = await Settings.findOne();
    
    if (req.xhr || req.path.startsWith('/api')) {
        return res.status(500).json({ error: 'Internal Server Error' });
    }
    
    res.status(500).render('error', {
        settings,
        config: {
            Site: {
                name: settings?.site?.name || 'Hex Status',
                description: settings?.site?.description || 'Service Status Monitor',
                footer: settings?.site?.footer || 'Hex Status'
            },
            URLs: {
                github: settings?.urls?.github || '#',
                thumbnail: settings?.urls?.thumbnail || 'https://hexarion.net/Hex-Status.png'
            },
            theme: {
                primary: settings?.theme?.primary || '#ff0000',
                secondary: settings?.theme?.secondary || '#000000',
                accent: settings?.theme?.accent || '#ff3333',
                background: settings?.theme?.background || '#1a1a1a'
            }
        },
        error: 'Something went wrong!'
    });
}

module.exports = errorHandler;