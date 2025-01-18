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
                    secondary: '#000000',
                    accent: '#ff3333',
                    background: '#1a1a1a'
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
            Object.assign(settings, newSettings);
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