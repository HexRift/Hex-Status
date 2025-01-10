const yaml = require('js-yaml');
const fs = require('fs');
const colors = require('colors');

let config = null;

function loadConfig() {
    try {
        config = yaml.load(fs.readFileSync('config.yml', 'utf8'));
        return config;
    } catch (error) {
        console.error("[System]".red, "Failed to load config:", error.message);
        process.exit(1);
    }
}

function getConfig() {
    if (!config) {
        config = loadConfig();
    }
    return config;
}

module.exports = { loadConfig, getConfig };
