const { EmbedBuilder } = require('discord.js');

async function sendHelpEmbed(interaction, { settings, client }) {
    // Get command IDs
    const statusCommand = client.application.commands.cache.find(cmd => cmd.name === 'status');
    const statsCommand = client.application.commands.cache.find(cmd => cmd.name === 'stats');
    const pingCommand = client.application.commands.cache.find(cmd => cmd.name === 'ping');
    const botinfoCommand = client.application.commands.cache.find(cmd => cmd.name === 'botinfo');
    const versioninfoCommand = client.application.commands.cache.find(cmd => cmd.name === 'version');
    const helpCommand = client.application.commands.cache.find(cmd => cmd.name === 'help');

    const helpEmbed = new EmbedBuilder()
        .setColor(settings.theme?.primary || '#007bff')
        .setTitle(`🎮 ${client.user.username} Commands`)
        .setDescription('Click on any command below to execute it:')
        .setThumbnail(settings.urls?.thumbnail || null)
        .addFields({
            name: '📊 Status Monitoring',
            value: `</status:${statusCommand?.id}>`,
            inline: false
        }, {
            name: '📈 Statistics & Analytics',
            value: `</stats:${statsCommand?.id}>`,
            inline: false
        }, {
            name: '🏓 Network Diagnostics',
            value: `</ping:${pingCommand?.id}>`,
            inline: false
        }, {
            name: '🤖 System Information',
            value: `</botinfo:${botinfoCommand?.id}>`,
            inline: false
        }, {
            name: '🚀 Version Information',
            value: `</version:${versioninfoCommand?.id}>`,
            inline: false
        }, {
            name: '❓ Help Center',
            value: `</help:${helpCommand?.id}>`,
            inline: false
        })
        .setTimestamp()
        .setFooter({
            text: `${settings.site?.footer || 'Hex Status'} • Version ${settings.system?.version || '14.0.0'}`,
            iconURL: settings.urls?.thumbnail || null
        });

    await interaction.reply({ embeds: [helpEmbed] });
}

module.exports = { sendHelpEmbed };