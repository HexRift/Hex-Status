const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const https = require('https');

async function checkVersionCommand(interaction, { settings, client }) {
    
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
    }

    try {
        const versionData = await new Promise((resolve, reject) => {
            
            https.get(`https://hexarion.net/api/version/check?version=${encodeURIComponent('14.0.0')}&product=40`, (res) => {
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
                    `**Current Version:** 14.0.0`,
                    `**Latest Version:** v${versionData?.release?.version || '14.0.0'}`,
                    `**Status:** ${versionData?.same ? '✅ Up to date' : '⚠️ Update required'}`
                ].join('\n'),
                inline: false
            })
            .setTimestamp()
            .setFooter({
                text: `${settings.site.footer || 'Hex Status'} • Version ${settings.site.version || '14.0.0'}`,
                iconURL: settings.urls.thumbnail  || null
            });
          const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

          // Create button
          const changelogButton = new ButtonBuilder()
              .setCustomId('view_changelog')
              .setLabel('View Changelog')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('📝');

          const row = new ActionRowBuilder().addComponents(changelogButton);

          // Send initial message with button
          await interaction.editReply({ embeds: [versionEmbed], components: [row] });

          // Create button collector
          const filter = i => i.customId === 'view_changelog' && i.user.id === interaction.user.id;
          const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

          collector.on('collect', async i => {
              const changelogEmbed = new EmbedBuilder()
                  .setTitle(`🚀 ${client.user.username} Changelog Info`)
                  .setThumbnail(settings.urls?.thumbnail || null)
                  .setColor(settings.theme?.primary || '#007bff')
                  .setTimestamp()
                  .setFooter({
                      text: `${settings.site.footer || 'Hex Status'} • Version ${settings.site.version || '14.0.0'}`,
                      iconURL: settings.urls.thumbnail  || null
                  });
              if (versionData?.release?.changelog) {
                  const sections = versionData.release.changelog.split('##').filter(Boolean);
                  for (const section of sections) {
                      const [title, ...content] = section.split('\r\n');
                      changelogEmbed.addFields({
                          name: `📝 ${title.trim()}`,
                          value: content.join('\n') || 'No details available',
                          inline: false
                      });
                  }
              }
    
              await i.reply({ embeds: [changelogEmbed], ephemeral: true });
          });
    } catch (error) {
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle(`❌ ${client.user.username} Version Check Failed`)
            .setThumbnail(settings.urls?.thumbnail || null)
            .setDescription(`Error: ${error.message}`)
            .setTimestamp()
            .setFooter({
                text: `${settings.site.footer || 'Hex Status'} • Version ${settings.site.version || '14.0.0'}`,
                iconURL: settings.urls.thumbnail  || null
            });

        await interaction.editReply({ embeds: [errorEmbed] });
    }
}

module.exports = { checkVersionCommand };