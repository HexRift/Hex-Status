function errorHandler(err, req, res, next) {
    console.error('[Error]'.red, err.stack);
    
    if (req.xhr || req.path.startsWith('/api')) {
        return res.status(500).json({ error: 'Internal Server Error' });
    }
    
    res.status(500).render('error', {
        config: req.app.locals.config,
        error: 'Something went wrong!'
    });
}

module.exports = errorHandler;
