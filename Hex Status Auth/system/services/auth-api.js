const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { EmbedBuilder, WebhookClient } = require('discord.js');
const colors = require('colors');
const mongoose = require('mongoose');
const License = require('../models/License');

class WebhookManager {
    static #instance;
    #webhook;
    #embedDefaults;

    constructor() {
        const webhookUrl = 'https://discord.com/api/webhooks/1323946852097458196/Rt13PpQ0YFRZhJhTFlZ_7uKeHjiK1Tfgd6R3kMqpdHh86tOGXoBP4wSHqVYMpWUVCiJV';
        this.#webhook = new WebhookClient({ url: webhookUrl });
        this.#embedDefaults = {
            thumbnail: 'https://hexarion.net/Hex-Status.png',
            footer: {
                text: '© 2024 - 2025 Hexarion',
                iconURL: 'https://hexarion.net/Hex-Status.png',
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

            await this.#webhook.send({ embeds: [embed] });
            return true;
        } catch (error) {
            console.error('[WEBHOOK]'.brightRed, 'Failed to send webhook:', error);
            return false;
        }
    }
}

class AuthClient {
    #webhookManager;
    #PRODUCT_ID = '40';
    #API_BASE_URL = 'https://api.hexarion.net/api';
    #currentVersion = '12.0.0'; // Hardcoded version

    async validateLicense() {
        try {
            const license = await License.findOne().sort({ _id: -1 });
            console.log('[AUTH]'.cyan, 'Found license:', license?.key);
            
            if (!license?.key) {
                console.log('[AUTH]'.brightRed, 'No license key found in database');
                process.exit(1);
            }

            const serverUrl = `${this.#API_BASE_URL}/check/${this.#PRODUCT_ID}`;

            console.log('[AUTH]'.brightYellow, 'Sending authentication request...');

            const response = await fetch(serverUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': license.key
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

      async checkVersion() {
        const https = require('https');
        
        return new Promise((resolve, reject) => {
            https.get(`https://hexarion.net/api/version/check?version=${encodeURIComponent(this.#currentVersion)}&product=${this.#PRODUCT_ID}`, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const parsedData = JSON.parse(data);
                        if (parsedData.same) {
                            console.log('[UPDATER]'.green, 'Your Hex Status installation is up to date!');
                        } else {
                            console.log('[UPDATER]'.red, 'Your Hex Status installation is outdated');
                            console.log('[UPDATER]'.yellow, 'Please update your Hex Status installation to the latest version.');
                            process.exit(1);
                        }
                        resolve(parsedData);
                    } catch (error) {
                        console.log('[UPDATER]'.red, 'Version check failed:', error.message);
                        reject(error);
                    }
                });
            }).on('error', (error) => {
                console.log('[UPDATER]'.red, 'Version check failed:', error.message);
                reject(error);
            });
        });
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
            }], {
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
            }], {
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
            }], {
                title: 'Authentication Error',
                description: 'An error occurred during authentication'
            }
        );
    }
}async function Auth(version) {
    const authClient = new AuthClient(version);
    const versionCheck = await authClient.checkVersion();
    const licenseCheck = await authClient.validateLicense();
    return { versionCheck, licenseCheck };
}
module.exports = { Auth };
