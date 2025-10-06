import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import moment from 'moment-timezone';
import express from 'express';
import 'dotenv/config';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Map to store user timezones
const userTimezones = new Map();

// ----- DISCORD COMMANDS -----
const commands = [
    new SlashCommandBuilder()
        .setName('settimezone')
        .setDescription('Set your timezone for time conversions')
        .addStringOption(option =>
            option.setName('timezone')
                  .setDescription('Your timezone (e.g., America/New_York)')
                  .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('convert')
        .setDescription('Convert a given time to your timezone')
        .addStringOption(option =>
            option.setName('time')
                  .setDescription('Time to convert (e.g., 3pm PST)')
                  .setRequired(true)
        )
].map(cmd => cmd.toJSON());

// Register slash commands globally
const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
(async () => {
    try {
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log('Slash commands registered.');
    } catch (err) {
        console.error(err);
    }
})();

// Handle slash commands
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'settimezone') {
        const tz = interaction.options.getString('timezone');

        if (!moment.tz.zone(tz)) {
            return interaction.reply({ content: 'Invalid timezone! Example: America/New_York', ephemeral: true });
        }

        userTimezones.set(interaction.user.id, tz);
        return interaction.reply({ content: `✅ Your timezone is set to ${tz}`, ephemeral: true });

    } else if (commandName === 'convert') {
        const inputTime = interaction.options.getString('time');
        const userTZ = userTimezones.get(interaction.user.id);

        if (!userTZ) {
            return interaction.reply({
                content: '⛔ You haven’t set your timezone yet. Use `/settimezone <timezone>` first.',
                ephemeral: true
            });
        }

        let convertedTime;
        try {
            convertedTime = moment.tz(inputTime, userTZ).format('YYYY-MM-DD HH:mm z');
        } catch (err) {
            return interaction.reply({ content: 'Failed to parse time. Try a format like "3pm PST"', ephemeral: true });
        }

        return interaction.reply({ content: `🕒 Your local time: ${convertedTime}`, ephemeral: true });
    }
});

client.login(process.env.BOT_TOKEN);

// ----- OPTIONAL: SIMPLE REST API FOR APP INTEGRATION -----
const app = express();

app.get('/convert', (req, res) => {
    const { time, userId } = req.query;
    if (!time || !userId) return res.status(400).json({ error: 'Missing time or userId' });

    const tz = userTimezones.get(userId) || 'UTC';
    let converted;
    try {
        converted = moment.tz(time, tz).format('YYYY-MM-DD HH:mm z');
    } catch (err) {
        return res.status(400).json({ error: 'Invalid time format' });
    }

    res.json({ converted });
});

app.listen(3000, () => console.log('REST API running on port 3000'));
