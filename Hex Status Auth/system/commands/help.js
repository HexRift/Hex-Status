const { EmbedBuilder } = require('discord.js');

async function sendHelpEmbed(interaction, { settings, client }) {
    const helpEmbed = new EmbedBuilder()
        .setColor(settings.theme?.primary || '#007bff')
        .setTitle(`🎮 ${client.user.username} Commands`)
        .setDescription('Explore the powerful features of Hex Status through these commands:')
        .setThumbnail(settings.urls?.thumbnail || null)
        .addFields({
            name: '📊 /status',
            value: 'View real-time status of all monitored services\n• Response times\n• Uptime statistics\n• System health',
            inline: false
        }, {
            name: '📈 /stats',
            value: 'Generate detailed performance graphs\n• Historical data\n• Response time trends\n• Visual analytics',
            inline: false
        }, {
            name: '🏓 /ping',
            value: 'Check detailed latency metrics\n• Bot latency\n• API response\n• Database status',
            inline: false
        }, {
            name: '🤖 /botinfo',
            value: 'View comprehensive bot statistics\n• System resources\n• Performance metrics\n• Service overview',
            inline: false
        }, {
            name: '❓ /help',
            value: 'Display this help menu with detailed command information',
            inline: false
        })
        .setTimestamp()
        .setFooter({
            text: `${settings.site?.footer || 'Hex Status'} • Version ${settings.system?.version || '9.0.0'}`,
            iconURL: settings.urls?.thumbnail || null
        });

    await interaction.reply({ embeds: [helpEmbed] });
}

module.exports = { sendHelpEmbed };
