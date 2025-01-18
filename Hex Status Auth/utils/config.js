const yaml = require('js-yaml');
const fs = require('fs');
const colors = require('colors');

function loadConfig() {
    try {
        return yaml.load(fs.readFileSync('config.yml', 'utf8'));
    } catch (error) {
        console.error("[System]".red, "Failed to load config:", error.message);
        process.exit(1);
    }
}

module.exports = { loadConfig };
