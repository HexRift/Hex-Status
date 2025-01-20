const Settings = require('../models/Settings');
const Service = require('../models/Service');
const colors = require('colors');

class SettingsService {
    static instance = null;
    static cache = null;
    static cacheTimeout = 5 * 60 * 1000; // 5 minutes
    static lastCacheUpdate = null;

    static getInstance() {
        if (!SettingsService.instance) {
            SettingsService.instance = new SettingsService();
        }
        return SettingsService.instance;
    }

    static async getSettings(forceRefresh = false) {
        if (!forceRefresh && this.isCacheValid()) {
            return this.cache;
        }

        let settings = await Settings.findOne();
        if (!settings) {
            settings = await this.createDefaultSettings();
        }

        this.updateCache(settings);
        return settings;
    }

    static isCacheValid() {
        return this.cache && 
               this.lastCacheUpdate && 
               (Date.now() - this.lastCacheUpdate) < this.cacheTimeout;
    }

    static updateCache(settings) {
        this.cache = settings;
        this.lastCacheUpdate = Date.now();
        console.log("[Settings]".cyan, "Cache updated");
    }

    static async createDefaultSettings() {
        console.log("[Settings]".yellow, "Creating default settings");
        return await Settings.create({
            site: {
                name: 'Hex Status',
                description: 'Real-time Service Status Monitor',
                footer: 'Hex Status',
                logo: '/images/Logo.png',
                favicon: '/images/favicon.ico'
            },
            urls: {
                github: 'https://hexarion.net/github',
                thumbnail: 'https://hexarion.net/Hex-Status.png',
                documentation: 'https://hexarion.net/docs'
            },
            system: {
                port: 3000,
                refresh_interval: 1000,
                version: '12.0.0',
                maxHistoryEntries: 50,
                debugMode: false,
                maintenance: false
            },
            theme: {
                primary: '#ff0000',
                secondary: '#1a1a1a',
                accent: '#ff3333',
                background: '#0a0a0a',
                text: '#ffffff',
                cardBg: '#1f1f1f',
                hover: '#ff1a1a',
                success: '#00ff00',
                warning: '#ffff00',
                error: '#ff0000'
            },
            mongodb: {
                uri: 'mongodb://localhost:27017/Hex-Status',
                options: {
                    useNewUrlParser: true,
                    useUnifiedTopology: true
                }
            },
            bot: {
                token: 'YOUR_BOT_TOKEN',
                prefix: '!',
                activity: 'monitoring services',
                embedColor: '#ff0000'
            },
            notifications: {
                discord: {
                    enabled: true,
                    webhookUrl: '',
                    mentionRole: ''
                },
                email: {
                    enabled: false,
                    smtp: {
                        host: '',
                        port: 587,
                        secure: true
                    }
                }
            }
        });
    }

    static async updateSettings(newSettings) {
        const settings = await this.getSettings(true);
        const updatedSettings = await this.mergeSettings(settings, newSettings);
        
        await settings.save();
        this.updateCache(settings);
        
        console.log("[Settings]".green, "Settings updated successfully");
        return settings;
    }

    static async mergeSettings(currentSettings, newSettings) {
        const sections = ['theme', 'site', 'urls', 'system', 'mongodb', 'bot', 'notifications'];
        
        for (const section of sections) {
            if (newSettings[section]) {
                currentSettings[section] = {
                    ...currentSettings[section],
                    ...newSettings[section]
                };
            }
        }
        
        return currentSettings;
    }

    static async deleteService(serviceName) {
        const result = await Service.deleteOne({ name: serviceName });
        if (result.deletedCount > 0) {
            console.log("[Settings]".green, `Service '${serviceName}' deleted successfully`);
            return true;
        }
        console.log("[Settings]".yellow, `Service '${serviceName}' not found`);
        return false;
    }

    static async validateSettings(settings) {
        const requiredFields = {
            'system.port': 'number',
            'system.refresh_interval': 'number',
            'mongodb.uri': 'string',
            'bot.token': 'string'
        };

        const errors = [];
        for (const [field, type] of Object.entries(requiredFields)) {
            const value = field.split('.').reduce((obj, key) => obj?.[key], settings);
            if (!value || typeof value !== type) {
                errors.push(`Invalid ${field}: expected ${type}`);
            }
        }

        return errors;
    }

    static async exportSettings() {
        const settings = await this.getSettings(true);
        const exportData = settings.toObject();
        delete exportData._id;
        delete exportData.__v;
        return exportData;
    }

    static async importSettings(settingsData) {
        const errors = await this.validateSettings(settingsData);
        if (errors.length > 0) {
            throw new Error(`Invalid settings: ${errors.join(', ')}`);
        }

        const settings = await Settings.findOne();
        if (settings) {
            Object.assign(settings, settingsData);
            await settings.save();
        } else {
            await Settings.create(settingsData);
        }

        this.updateCache(null);
        return await this.getSettings(true);
    }
}

module.exports = SettingsService;
