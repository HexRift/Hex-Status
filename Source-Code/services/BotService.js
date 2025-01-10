const { Client, GatewayIntentBits, SlashCommandBuilder } = require('discord.js');
const colors = require('colors');
const { sendStatusEmbed } = require('../commands/status');
const { handleStatsCommand } = require('../commands/stats');
const { sendHelpEmbed } = require('../commands/help');
const { handlePingCommand } = require('../commands/ping');
const { handleBotInfoCommand } = require('../commands/botinfo');

class BotService {
    constructor(config) {
        this.config = config;
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ]
        });
    }

    async initialize() {
        const commands = [
            new SlashCommandBuilder()
                .setName('status')
                .setDescription('Show current status of all services'),
            new SlashCommandBuilder()
                .setName('stats')
                .setDescription('Show statistical graphs of service performance'),
            new SlashCommandBuilder()
                .setName('help')
                .setDescription('Show available commands and their usage'),
            new SlashCommandBuilder()
                .setName('ping')
                .setDescription('View detailed ping and latency information'),
            new SlashCommandBuilder()
                .setName('botinfo')
                .setDescription('Display comprehensive bot statistics and information')
        ];

        this.client.on('ready', () => {
            console.log("[Bot]".green, `Logged in as ${this.client.user.tag}`);
            this.client.application.commands.set(commands);
        });

        this.client.on('interactionCreate', async interaction => {
            if (!interaction.isCommand()) return;

            const commandConfig = {
                config: this.config,
                client: this.client
            };

            try {
                switch (interaction.commandName) {
                    case 'status':
                        await sendStatusEmbed(interaction, commandConfig);
                        break;
                    case 'stats':
                        await handleStatsCommand(interaction, commandConfig);
                        break;
                    case 'help':
                        await sendHelpEmbed(interaction, commandConfig);
                        break;
                    case 'ping':
                        await handlePingCommand(interaction, commandConfig);
                        break;
                    case 'botinfo':
                        await handleBotInfoCommand(interaction, commandConfig);
                        break;
                }
            } catch (error) {
                console.error('[Bot]'.red, 'Command error:', error);
                await interaction.reply({ content: 'An error occurred while processing the command.', ephemeral: true });
            }
        });

        await this.client.login(this.config.Bot.token);
        return this.client;
    }
}
module.exports = { BotService };