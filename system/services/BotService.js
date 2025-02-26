const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  Collection,
  ActivityType,
} = require("discord.js");
const colors = require("colors");
const { StatusMessage } = require("../models/StatusMessage");
const { sendStatusEmbed, startStatusUpdates } = require("../commands/status");
const { handleStatsCommand } = require("../commands/stats");
const { sendHelpEmbed } = require("../commands/help");
const { handlePingCommand } = require("../commands/ping");
const { handleBotInfoCommand } = require("../commands/botinfo");
const { checkVersionCommand } = require("../commands/version");
const { handleSetStatusCommand } = require("../commands/setstatus");
const { BotStatus } = require("../models/BotStatus");

class BotService {
  constructor(settings) {
    this.settings = settings;
    this.commands = new Collection();
    this.cooldowns = new Collection();
    this.startTime = Date.now();

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences,
      ],
      presence: {
        activities: [
          {
            name: "services status",
            type: ActivityType.Watching,
          },
        ],
      },
    });

    this.setupCommands();
  }

  setupCommands() {
    this.commands.set("status", {
      builder: new SlashCommandBuilder()
        .setName("status")
        .setDescription("Show current status of all services"),
      execute: sendStatusEmbed,
      cooldown: 10,
    });

    this.commands.set("stats", {
      builder: new SlashCommandBuilder()
        .setName("stats")
        .setDescription("Show statistical graphs of service performance"),
      execute: handleStatsCommand,
      cooldown: 30,
    });

    this.commands.set("help", {
      builder: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Show available commands and their usage"),
      execute: sendHelpEmbed,
      cooldown: 5,
    });

    this.commands.set("ping", {
      builder: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("View detailed ping and latency information"),
      execute: handlePingCommand,
      cooldown: 5,
    });

    this.commands.set("botinfo", {
      builder: new SlashCommandBuilder()
        .setName("botinfo")
        .setDescription("Display comprehensive bot statistics and information"),
      execute: handleBotInfoCommand,
      cooldown: 10,
    });

    this.commands.set("version", {
      builder: new SlashCommandBuilder()
        .setName("version")
        .setDescription(
          "Check for hex status updates and display version information"
        ),
      execute: checkVersionCommand,
      cooldown: 10,
    });

    this.commands.set("setstatus", {
      builder: new SlashCommandBuilder()
        .setName("setstatus")
        .setDescription("Set the bot's status message")
        .addStringOption((option) =>
          option
            .setName("status")
            .setDescription("The status message to display")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("Activity type")
            .setRequired(true)
            .addChoices(
              { name: "Watching", value: "WATCHING" },
              { name: "Playing", value: "PLAYING" },
              { name: "Listening", value: "LISTENING" },
              { name: "Competing", value: "COMPETING" }
            )
        ),
      execute: handleSetStatusCommand,
      cooldown: 10,
    });
  }

  async initialize() {
    this.setupEventHandlers();
    await this.login();
    await this.registerCommands();
    return this.client;
  }
  setupEventHandlers() {
    this.client.on("ready", async () => {
      this.handleReady();

      try {
        const StatusMessageModel = require("../models/StatusMessage");
        if (StatusMessageModel) {
          const statusMessages = await StatusMessageModel.find().lean();
          if (statusMessages && statusMessages.length > 0) {
            for (const config of statusMessages) {
              const channel = await this.client.channels.fetch(
                config.channelId
              );
              const message = await channel.messages.fetch(config.messageId);
              startStatusUpdates(this.client, channel, message, this.settings);
            }
          }
        }
      } catch (error) {
        console.log("[Bot]".cyan, "No status messages to restore");
      }
    });

    this.client.on("interactionCreate", (interaction) =>
      this.handleInteraction(interaction)
    );
    this.client.on("error", (error) => this.handleError(error));
    this.client.on("disconnect", () => this.handleDisconnect());
  }
  async handleReady() {
    console.log("[Bot]".green, `Logged in as ${this.client.user.tag}`);
    this.updateStatus();
    setInterval(() => this.updateStatus(), 300000); // Update status every 5 minutes
  }

  async handleInteraction(interaction) {
    if (!interaction.isCommand()) return;

    const command = this.commands.get(interaction.commandName);
    if (!command) return;

    if (this.isOnCooldown(interaction, command)) {
      return;
    }

    try {
      await command.execute(interaction, {
        settings: this.settings,
        client: this.client,
      });
    } catch (error) {
      this.handleCommandError(interaction, error);
    }
  }

  isOnCooldown(interaction, command) {
    if (!this.cooldowns.has(command.builder.name)) {
      this.cooldowns.set(command.builder.name, new Collection());
    }

    const timestamps = this.cooldowns.get(command.builder.name);
    const cooldownAmount = (command.cooldown || 3) * 1000;
    const now = Date.now();

    if (timestamps.has(interaction.user.id)) {
      const expirationTime =
        timestamps.get(interaction.user.id) + cooldownAmount;
      if (now < expirationTime) {
        const timeLeft = (expirationTime - now) / 1000;
        interaction.reply({
          content: `Please wait ${timeLeft.toFixed(
            1
          )} seconds before using this command again.`,
          ephemeral: true,
        });
        return true;
      }
    }

    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);
    return false;
  }

  async handleCommandError(interaction, error) {
    console.error("[Bot]".red, "Command error:", error);
    const errorMessage = this.settings.debug
      ? `Error: ${error.message}`
      : "An error occurred while processing the command.";

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }

  handleError(error) {
    console.error("[Bot]".red, "Client error:", error);
  }

  handleDisconnect() {
    console.log("[Bot]".yellow, "Disconnected from Discord");
    setTimeout(() => this.login(), 5000);
  }

  async login() {
    try {
      await this.client.login(this.settings.bot.token);
    } catch (error) {
      console.error("[Bot]".red, "Login failed:", error);
      process.exit(1);
    }
  }

  async registerCommands() {
    try {
      const commandsArray = [...this.commands.values()].map(
        (cmd) => cmd.builder
      );
      await this.client.application.commands.set(commandsArray);
    } catch (error) {
      console.error("[Bot]".red, "Failed to register commands:", error);
    }
  }

  // Update the updateStatus method
  async updateStatus() {
    try {
        const BotStatusModel = require('../models/BotStatus');
        const serverCount = this.client.guilds.cache.size;
        
        let botStatus;
        if (BotStatusModel) {
            botStatus = await BotStatusModel.findOne().lean();
        }

        this.client.user.setActivity(`${botStatus?.status || this.settings.bot.status}`, {
            type: ActivityType[botStatus?.type || 'WATCHING']
        });
    } catch (error) {
        console.log('[Bot]'.cyan, 'Using default status configuration');
        this.client.user.setActivity(`${this.settings.bot.status}`, {
            type: ActivityType.WATCHING
        });
    }
}


  async cleanup() {
    if (this.client) {
      await this.client.destroy();
      console.log("[Bot]".yellow, "Discord client destroyed");
    }
  }
}

module.exports = { BotService };
