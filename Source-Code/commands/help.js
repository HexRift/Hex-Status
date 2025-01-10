const { EmbedBuilder } = require('discord.js');

async function sendHelpEmbed(interaction, { config, client }) {
    const helpEmbed = new EmbedBuilder()
        .setColor(config.theme?.primary || '#007bff')
        .setTitle(`🎮 ${client.user.username} Commands`)
        .setDescription('Explore the powerful features of Hex Status through these commands:')
        .setThumbnail(config.URLs?.thumbnail || null)
        .addFields({
            name: '📊 /status',
            value: 'View real-time status of all monitored services\n• Response times\n• Uptime statistics\n• System health',
            inline: true
        }, {
            name: '📈 /stats',
            value: 'Generate detailed performance graphs\n• Historical data\n• Response time trends\n• Visual analytics',
            inline: true
        }, {
            name: '🏓 /ping',
            value: 'Check detailed latency metrics\n• Bot latency\n• API response\n• Database status',
            inline: true
        }, {
            name: '🤖 /botinfo',
            value: 'View comprehensive bot statistics\n• System resources\n• Performance metrics\n• Service overview',
            inline: true
        }, {
            name: '❓ /help',
            value: 'Display this help menu with detailed command information',
            inline: true
        })
        .setTimestamp()
        .setFooter({
            text: `${config.Site?.footer || 'Hex Status'} • Version ${config.System?.version || '8.0.0'}`,
            iconURL: config.URLs?.thumbnail || null
        });

    await interaction.reply({ embeds: [helpEmbed] });
}

module.exports = { sendHelpEmbed };
