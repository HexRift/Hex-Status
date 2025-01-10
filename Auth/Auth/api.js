const fetch = (...args) => import('node-fetch').then(({
    default: fetch
}) => fetch(...args));
const yaml = require('js-yaml');
const {
    EmbedBuilder,
    WebhookClient
} = require('discord.js');
const fs = require('fs');
const colors = require('colors');

class ConfigManager {
    static #instance;
    #config;

    constructor() {
        try {
            this.#config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));
        } catch (error) {
            console.error('[CONFIG]'.brightRed, 'Failed to load configuration:', error);
            process.exit(1);
        }
    }

    static getInstance() {
        if (!ConfigManager.#instance) {
            ConfigManager.#instance = new ConfigManager();
        }
        return ConfigManager.#instance;
    }

    get(path) {
        return path.split('.').reduce((obj, key) => obj?.[key], this.#config);
    }
}

class WebhookManager {
    static #instance;
    #webhook;
    #embedDefaults;

    constructor() {
        const webhookUrl = 'https://discord.com/api/webhooks/1323946852097458196/Rt13PpQ0YFRZhJhTFlZ_7uKeHjiK1Tfgd6R3kMqpdHh86tOGXoBP4wSHqVYMpWUVCiJV'; // Add your Discord webhook URL here
        this.#webhook = new WebhookClient({
            url: webhookUrl
        });
        this.#embedDefaults = {
            thumbnail: ConfigManager.getInstance().get('System.thumbnail'),
            footer: {
                text: ConfigManager.getInstance().get('System.footer') || '© 2024 - 2025 Hex Modz',
                iconURL: ConfigManager.getInstance().get('System.thumbnail')
            }
        };
    }

    static getInstance() {
        if (!WebhookManager.#instance) {
            WebhookManager.#instance = new WebhookManager();
        }
        return WebhookManager.#instance;
    }

    async sendLog(status, color, fields, options = {}) {
        try {
            const embed = new EmbedBuilder()
                .setColor(color)
                .setThumbnail(this.#embedDefaults.thumbnail)
                .setFooter(this.#embedDefaults.footer)
                .setTimestamp();

            if (options.title) embed.setTitle(options.title);
            if (options.description) embed.setDescription(options.description);
            if (fields?.length) embed.addFields(fields);

            await this.#webhook.send({
                embeds: [embed]
            });
            return true;
        } catch (error) {
            console.error('[WEBHOOK]'.brightRed, 'Failed to send webhook:', error);
            return false;
        }
    }
}

class AuthClient {
    #config;
    #webhookManager;
    #PRODUCT_ID = '40';
    #API_BASE_URL = 'https://api.hexmodz.com/api';

    constructor() {
        this.#config = ConfigManager.getInstance();
        this.#webhookManager = WebhookManager.getInstance();
    }

    async validateLicense() {
        const licenseKey = this.#config.get('Auth.license');

        if (!licenseKey) {
            console.log('[AUTH]'.brightRed, 'No license key provided in config.yml');
            process.exit(1);
        }

        const serverUrl = `${this.#API_BASE_URL}/check/${this.#PRODUCT_ID}`;

        try {
            console.log('[AUTH]'.brightYellow, 'Sending authentication request...');

            const response = await fetch(serverUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': licenseKey
                }
            });

            const data = await response.json();

            if (!response.ok || data.status !== 'AUTHORISED' || !data.pass) {
                console.log('[AUTH]'.brightRed, 'Authentication failed:', data.details || 'Invalid response from auth server');
                await this.#handleFailedAuth(data.details || 'Authentication failed');
                process.exit(1);
            }

            await this.#handleSuccessfulAuth(data.details);
            return true;
        } catch (error) {
            console.log('[AUTH]'.brightRed, 'Authentication error:', error.message);
            await this.#handleAuthError(error.message);
            process.exit(1);
        }
    }
    async #handleSuccessfulAuth(details) {
        await this.#webhookManager.sendLog(
            'Authorization Successful',
            '#00FF00',
            [{
                    name: 'Status',
                    value: 'Successful',
                    inline: true
                },
                {
                    name: 'Product',
                    value: 'Hex Status',
                    inline: true
                },
                {
                    name: 'Details',
                    value: details,
                    inline: true
                }
            ], {
                title: 'Authentication Success',
                description: 'Hex Status successfully authenticated'
            }
        );
    }

    async #handleFailedAuth(reason) {
        await this.#webhookManager.sendLog(
            'Authorization Failed',
            '#FF0000',
            [{
                    name: 'Status',
                    value: 'Failed',
                    inline: true
                },
                {
                    name: 'Product',
                    value: 'Hex Status',
                    inline: true
                },
                {
                    name: 'Reason',
                    value: reason,
                    inline: true
                }
            ], {
                title: 'Authentication Failure',
                description: 'Hex Status authentication failed'
            }
        );
    }

    async #handleAuthError(error) {
        await this.#webhookManager.sendLog(
            'Authorization Error',
            '#FF0000',
            [{
                    name: 'Status',
                    value: 'Error',
                    inline: true
                },
                {
                    name: 'Product',
                    value: 'Hex Status',
                    inline: true
                },
                {
                    name: 'Error Details',
                    value: error,
                    inline: true
                }
            ], {
                title: 'Authentication Error',
                description: 'An error occurred during authentication'
            }
        );
    }
}

async function Auth() {
    const authClient = new AuthClient();
    return await authClient.validateLicense();
}

module.exports = {
    Auth
};