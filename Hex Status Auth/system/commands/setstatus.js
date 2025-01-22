const { EmbedBuilder, ActivityType } = require('discord.js');
const BotStatus = require('../models/BotStatus');

async function handleSetStatusCommand(interaction, { client, settings }) {
    await interaction.deferReply();
    
    const status = interaction.options.getString('status');
    const type = interaction.options.getString('type');
    const timestamp = new Date();

    const BotStatusModel = require('../models/BotStatus');
    await BotStatusModel.findOneAndUpdate({}, {
        status: status,
        type: type,
        timestamp: timestamp
    }, { upsert: true });

    // Update bot's activity
    client.user.setActivity(`${status}`, {
        type: ActivityType[type]
    });

    // Create rich embed response with settings
    const statusEmbed = new EmbedBuilder()
        .setColor(settings?.colors?.success || '#00ff00')
        .setTitle(`🎮 ${client.user.username} Updated`)
        .setDescription(`Set ${client.user.username} Bot's status`)
        .setThumbnail(settings.urls?.thumbnail || null)
        .addFields(
            {
                name: '📝 New Status',
                value: `\`${status}\``,
                inline: true
            },
            {
                name: '🎯 Activity Type',
                value: `\`${type}\``,
                inline: true
            },
            {
                name: '⏰ Updated At',
                value: `<t:${Math.floor(timestamp / 1000)}:R>`,
                inline: true
            },
            {
                name: '📊 Current Display',
                value: `${type} \`${status}\``,
                inline: false
            }
        )
        .setTimestamp()
        .setFooter({
            text: `${settings.site.footer || 'Hex Status'} • Version ${settings.site.version || '10.0.0'}`,
            iconURL: settings.urls.thumbnail  || null
        });

    const previewText = [
        '**Preview:**',
        '',
        `Activity Type: ${type}`,
        `Status Message: ${status}`,
        `Display Format: ${client.user.username} is ${type.toLowerCase()} ${status}`,
        ''
    ].join('\n');

    await interaction.editReply({
        embeds: [statusEmbed]
    });
}

module.exports = { handleSetStatusCommand };