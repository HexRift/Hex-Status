const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const yaml = require('js-yaml');
const { EmbedBuilder, WebhookClient } = require('discord.js');
const fs = require('fs');
const colors = require('colors');

// Configuration Management
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

// Webhook Manager
class WebhookManager {
    static #instance;
    #webhook;

    constructor() {
        const webhookUrl = 'https://discord.com/api/webhooks/1323946852097458196/Rt13PpQ0YFRZhJhTFlZ_7uKeHjiK1Tfgd6R3kMqpdHh86tOGXoBP4wSHqVYMpWUVCiJV';
        this.#webhook = new WebhookClient({ url: webhookUrl });
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
                .addFields(fields)
                .setColor(color)
                .setThumbnail('https://www.hexmodz.com/Logo-t1.png')
                .setFooter({
                    iconURL: 'https://www.hexmodz.com/Logo-t1.png',
                    text: '© 2024 - 2025 Hex Modz',
                })
                .setTimestamp();

            if (options.title) embed.setTitle(options.title);
            if (options.description) embed.setDescription(options.description);

            await this.#webhook.send({ embeds: [embed] });
        } catch (error) {
            console.error('[WEBHOOK]'.brightRed, 'Failed to send webhook:', error);
        }
    }
}

// Auth Client
class AuthClient {
    #config;
    #webhookManager;

    constructor() {
        this.#config = ConfigManager.getInstance();
        this.#webhookManager = WebhookManager.getInstance();
    }

    async validateLicense() {
        const PRODUCT_ID = '38';
        const licenseKey = this.#config.get('Auth.license');
        const serverUrl = `https://api.hexmodz.com/api/check/${PRODUCT_ID}`;
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': licenseKey,
            },
        };

        try {
            console.log('[AUTH]'.brightYellow, 'Sending authentication request...');
            const response = await fetch(serverUrl, options);

            if (!response.ok) {
                await this.#handleAuthError(PRODUCT_ID, response.statusText);
                throw new Error(`HTTP Error: ${response.status}`);
            }

            const data = await response.json();

            // Updated condition to match the actual response
            if (data.status === 'AUTHORISED' && data.pass === true) {
                await this.#handleSuccessfulAuth(PRODUCT_ID, data.details);
                return true;
            } else {
                await this.#handleFailedAuth(PRODUCT_ID, data.details || 'License validation failed');
                throw new Error(data.details || 'License validation failed');
            }
        } catch (error) {
            console.error('[AUTH]'.brightRed, 'Authorization error:', error.message);
            await this.#handleAuthError(PRODUCT_ID, error.message);
            throw error;
        }
    }

    async #handleSuccessfulAuth(productId, details) {
        await this.#webhookManager.sendLog(
            'Authorization Successful',
            '#00FF00',
            [
                { name: 'Status', value: 'Successful', inline: true },
                { name: 'Product', value: "Hex Status", inline: true },
                { name: 'Details', value: details, inline: true },
            ],
            { title: 'Authentication Success', description: 'Hex Status successfully authenticated' }
        );
    }

    async #handleFailedAuth(productId, reason) {
        await this.#webhookManager.sendLog(
            'Authorization Failed',
            '#FF0000',
            [
                { name: 'Status', value: 'Failed', inline: true },
                { name: 'Product', value: "Hex Status", inline: true },
                { name: 'Reason', value: reason, inline: true },
            ],
            { title: 'Authentication Failure', description: 'Hex Status authentication failed' }
        );
    }

    async #handleAuthError(productId, error) {
        await this.#webhookManager.sendLog(
            'Authorization Error',
            '#FF0000',
            [
                { name: 'Status', value: 'Error', inline: true },
                { name: 'Product', value: "Hex Status", inline: true },
                { name: 'Error Details', value: error, inline: true },
            ],
            { title: 'Authentication Error', description: 'An error occurred during authentication' }
        );
    }
}


// Auth Function
async function Auth() {
    const authClient = new AuthClient();
    try {
        await authClient.validateLicense();
    } catch (error) {
        console.error('[AUTH]'.brightRed, 'Authentication process failed:', error.message);
        process.exit(1); // Exit on failure
    }
}

module.exports = { Auth };