const Settings = require('../models/Settings');
const Service = require('../models/Service');

class SettingsService {
    static async getSettings() {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = await Settings.create({
                site: {
                    name: 'Hex Status',
                    description: 'Real-time Service Status Monitor',
                    footer: 'Hex Status'
                },
                urls: {
                    github: 'https://hexarion.net/github',
                    thumbnail: 'https://hexarion.net/assets/logo.png'
                },
                system: {
                    port: 3000,
                    refresh_interval: 1000,
                    version: '11.0.0'
                },
                theme: {
                    primary: '#ff0000',
                    secondary: '#1a1a1a',
                    accent: '#ff3333',
                    background: '#0a0a0a',
                    text: '#ffffff',
                    cardBg: '#1f1f1f',
                    hover: '#ff1a1a'
                },
                mongodb: {
                    uri: 'mongodb://localhost:27017/Hex-Status'
                },
                bot: {
                    token: 'YOUR_BOT_TOKEN'
                }
            });
        }
        return settings;
    }

    static async updateSettings(newSettings) {
        const settings = await Settings.findOne();
        if (settings) {
            if (newSettings.theme) {
                settings.theme = {
                    ...settings.theme,
                    ...newSettings.theme
                };
            }
            if (newSettings.site) {
                settings.site = {
                    ...settings.site,
                    ...newSettings.site
                };
            }
            if (newSettings.urls) {
                settings.urls = {
                    ...settings.urls,
                    ...newSettings.urls
                };
            }
            if (newSettings.system) {
                settings.system = {
                    ...settings.system,
                    ...newSettings.system
                };
            }
            if (newSettings.mongodb) {
                settings.mongodb = {
                    ...settings.mongodb,
                    ...newSettings.mongodb
                };
            }
            if (newSettings.bot) {
                settings.bot = {
                    ...settings.bot,
                    ...newSettings.bot
                };
            }
            await settings.save();
        }
        return settings;
    }

    static async deleteService(serviceName) {
        const result = await Service.deleteOne({ name: serviceName });
        return result.deletedCount > 0;
    }
}

module.exports = SettingsService;
