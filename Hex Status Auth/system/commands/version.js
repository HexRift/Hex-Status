const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const https = require('https');

async function checkVersionCommand(interaction, { settings, client }) {
    
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
    }

    try {
        const versionData = await new Promise((resolve, reject) => {
            
            https.get(`https://hexarion.net/api/version/check?version=${encodeURIComponent('13.0.0')}&product=40`, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (error) {
                        reject(error);
                    }
                });
            }).on('error', reject);
        });

        const versionEmbed = new EmbedBuilder()
            .setColor(settings.theme?.primary || '#007bff')
            .setTitle(`🚀 ${client.user.username} Version Info`)
            .setThumbnail(settings.urls?.thumbnail || null)
            .addFields({
                name: '📊 Version Information',
                value: [
                    `**Current Version:** v13.0.0`,
                    `**Latest Version:** v${versionData?.release?.version || '13.0.0'}`,
                    `**Status:** ${versionData?.same ? '✅ Up to date' : '⚠️ Update required'}`
                ].join('\n'),
                inline: false
            })
            .setTimestamp()
            .setFooter({
                text: `${settings.site.footer || 'Hex Status'} • Version ${settings.site.version || '13.0.0'}`,
                iconURL: settings.urls.thumbnail  || null
            });

        if (versionData?.release?.changelog) {
            const sections = versionData.release.changelog.split('##').filter(Boolean);
            for (const section of sections) {
                const [title, ...content] = section.split('\r\n');
                const truncatedContent = content.join('\n').slice(0, 900) + (content.join('\n').length > 900 ? '...' : '');
                versionEmbed.addFields({
                    name: `📝 ${title.trim()}`,
                    value: truncatedContent || 'No details available',
                    inline: false
                });
            }
        }

        await interaction.editReply({ embeds: [versionEmbed] });

    } catch (error) {
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle(`❌ ${client.user.username} Version Check Failed`)
            .setThumbnail(settings.urls?.thumbnail || null)
            .setDescription(`Error: ${error.message}`)
            .setTimestamp()
            .setFooter({
                text: `${settings.site.footer || 'Hex Status'} • Version ${settings.site.version || '10.0.0'}`,
                iconURL: settings.urls.thumbnail  || null
            });

        await interaction.editReply({ embeds: [errorEmbed] });
    }
}

module.exports = { checkVersionCommand };