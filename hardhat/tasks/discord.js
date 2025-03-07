const { ReadableStream } = require("web-streams-polyfill");
global.ReadableStream = ReadableStream;

const { Client, GatewayIntentBits } = require("discord.js");
const { task } = require("hardhat/config");

const Logs = require("node-logs");
const logger = new Logs().showInConsole(true);

const dotenv = require("dotenv");
dotenv.config();

const discordClient = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

// console.log(`WATCHER BOT TOKEN:${process.env.WATCHER_BOT_TOKEN}`);

// async function waitForReady() {
//     await new Promise((resolve) => discordClient.once("ready", resolve));
// }

task("discord:sendAlertMessage", "Send a message to a specific channel")
    .addParam("channelId", "The ID of the channel to send the message to")
    .addParam("message", "The message to send")
    .addOptionalParam("userId", "The ID of the user to mention")
    .setAction(async ({ channelId, message, userId }) => {
        await discordClient.login(process.env.WATCHER_BOT_TOKEN);
        let messageToSend = message;
        if (userId) {
            messageToSend = `<@${userId}>\n${message}`;
        }
        try {
            // await waitForReady();
            logger.info(`Logged in as ${discordClient.user.tag}`);
            const channel = await discordClient.channels.fetch(channelId);
            if (!channel) {
                logger.error(`Channel not found: ${channelId}`);
                return;
            }
            await channel.send(messageToSend);
            logger.success(`Message sent to channel: ${channelId}`);
        } catch (error) {
            logger.error(`Error sending message to Discord: ${error.message}`);
        } finally {
            discordClient.destroy();
        }
    });

task("discord:sendCalmMessage", "Send a message to a specific channel")
    .addParam("channelId", "The ID of the channel to send the message to")
    .setAction(async ({ channelId }) => {
        await discordClient.login(process.env.WATCHER_BOT_TOKEN);
        try {
            // await waitForReady();
            logger.info(`Logged in as ${discordClient.user.tag}`);
            const channel = await discordClient.channels.fetch(channelId);
            if (!channel) {
                logger.error(`Channel not found: ${channelId}`);
                return;
            }
            const message = `🟢 WATCHER: FUNDS ENOUGH ✅`;
            await channel.send(message);
            logger.success(`Message sent to channel: ${channelId}`);
        } catch (error) {
            logger.error(`Error sending message to Discord: ${error.message}`);
        } finally {
            discordClient.destroy();
        }
    });
