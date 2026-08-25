require('dotenv').config();
const http = require('http');
const { 
    Client, 
    GatewayIntentBits, 
    ActivityType, 
    EmbedBuilder, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    Events,
    ChannelType
} = require('discord.js');
const { 
    joinVoiceChannel, 
    VoiceConnectionStatus, 
    entersState,
    getVoiceConnection
} = require('@discordjs/voice');

// 1. Web Server nhỏ để giữ Render / UptimeRobot ping 24/7
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Bot Discord 24/7 Status</title>
            <meta charset="utf-8">
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .card { background: #1e293b; padding: 2.5rem; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); text-align: center; max-width: 420px; width: 90%; border: 1px solid #334155; }
                .status { color: #22c55e; font-weight: 700; font-size: 1.3rem; margin: 15px 0; }
                .badge { background: #334155; color: #94a3b8; padding: 8px 16px; border-radius: 20px; font-size: 0.9rem; display: inline-block; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1 style="font-size: 1.6rem; margin-top: 0;">🤖 Bot Treo Voice & Máy 24/7</h1>
                <p class="status">🟢 Bot Đang Hoạt Động</p>
                <div class="badge">Uptime: ${Math.floor(process.uptime())}s</div>
            </div>
        </body>
        </html>
    `);
});

server.listen(PORT, () => {
    console.log(`[Web Server] Đang lắng nghe trên cổng: ${PORT}`);
});

// 2. Khởi tạo Discord Bot Client (Thêm GuildVoiceStates để vào Voice Call)
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// Danh sách Slash Commands
const commands = [
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Kiểm tra độ trễ của Bot'),
    new SlashCommandBuilder()
        .setName('status')
        .setDescription('Xem trạng thái hoạt động 24/7 của Bot'),
    new SlashCommandBuilder()
        .setName('join')
        .setDescription('Bảo bot vào kênh thoại (Voice Channel) để treo 24/7')
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('Chọn phòng Voice (để trống nếu muốn bot vào phòng bạn đang đứng)')
                .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
                .setRequired(false)
        ),
    new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Bảo bot rời khỏi phòng Voice'),
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Xem danh sách hướng dẫn lệnh')
].map(command => command.toJSON());

// Hàm kết nối và duy trì Voice 24/7 với chế độ tự động phục hồi kết nối
function connectToVoice(channel) {
    const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
            await Promise.race([
                entersState(connection, VoiceConnectionStatus.Signalling, 5000),
                entersState(connection, VoiceConnectionStatus.Connecting, 5000),
            ]);
            // Kết nối lại thành công
        } catch {
            // Nếu bị mất mạng hoặc kick, tự động kết nối lại sau 5 giây
            console.log(`[Voice] Mất kết nối phòng ${channel.name}, đang kết nối lại...`);
            setTimeout(() => connectToVoice(channel), 5000);
        }
    });

    console.log(`[Voice] Đã vào phòng thoại: ${channel.name} (${channel.guild.name})`);
    return connection;
}

// Khi bot đăng nhập thành công
client.once(Events.ClientReady, async (c) => {
    console.log('================================================');
    console.log(`[Discord] Bot đã kết nối thành công: ${c.user.tag}`);
    console.log(`[Discord] Đang trực thuộc ${c.guilds.cache.size} server`);
    console.log('================================================');

    // Đăng ký Slash Commands
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        await rest.put(
            Routes.applicationCommands(c.user.id),
            { body: commands }
        );
        console.log('[Slash Commands] Đã cập nhật thành công các lệnh (/join, /leave, /ping, /status, /help)');
    } catch (err) {
        console.error('[Slash Commands Error]', err.message);
    }

    // Tự động vào phòng Voice cố định nếu có thiết lập VOICE_CHANNEL_ID trong biến môi trường
    const autoVoiceId = process.env.VOICE_CHANNEL_ID;
    if (autoVoiceId) {
        try {
            const channel = await c.channels.fetch(autoVoiceId);
            if (channel && (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice)) {
                connectToVoice(channel);
            }
        } catch (err) {
            console.error('[Auto Voice Error]', err.message);
        }
    }

    // Cài đặt trạng thái hoạt động (Status / Presence)
    const updatePresence = () => {
        c.user.setPresence({
            activities: [{
                name: '🔊 Treo Voice 24/7 | /join',
                type: ActivityType.Custom
            }],
            status: 'online'
        });
    };

    updatePresence();
    setInterval(updatePresence, 15 * 60 * 1000);
});

// Xử lý Slash Commands
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    // Lệnh /join
    if (commandName === 'join') {
        let voiceChannel = interaction.options.getChannel('channel');

        // Nếu không chọn phòng, lấy phòng của người dùng đang đứng
        if (!voiceChannel) {
            voiceChannel = interaction.member?.voice?.channel;
        }

        if (!voiceChannel) {
            return interaction.reply({
                content: '❌ Bạn cần vào một phòng thoại trước, hoặc chọn một phòng trong tuỳ chọn lệnh!',
                ephemeral: true
            });
        }

        try {
            connectToVoice(voiceChannel);
            return interaction.reply({
                content: `✅ Đã tham gia phòng thoại **${voiceChannel.name}** và sẽ treo 24/7!`,
            });
        } catch (err) {
            return interaction.reply({
                content: `❌ Lỗi khi vào phòng thoại: ${err.message}`,
                ephemeral: true
            });
        }
    }

    // Lệnh /leave
    if (commandName === 'leave') {
        const connection = getVoiceConnection(interaction.guildId);
        if (!connection) {
            return interaction.reply({ content: '❌ Bot hiện không ở trong phòng thoại nào!', ephemeral: true });
        }

        connection.destroy();
        return interaction.reply({ content: '👋 Bot đã rời khỏi phòng thoại!' });
    }

    // Lệnh /ping
    if (commandName === 'ping') {
        const ping = Date.now() - interaction.createdTimestamp;
        const apiPing = Math.round(client.ws.ping);
        return interaction.reply(`🏓 **Pong!**\n- Độ trễ tin nhắn: \`${ping}ms\`\n- Độ trễ Discord API: \`${apiPing}ms\``);
    } 

    // Lệnh /status
    if (commandName === 'status') {
        const uptimeHours = (process.uptime() / 3600).toFixed(2);
        const memoryMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const connection = getVoiceConnection(interaction.guildId);

        const embed = new EmbedBuilder()
            .setColor('#22c55e')
            .setTitle('📊 Trạng Thái Bot Treo Máy 24/7')
            .addFields(
                { name: '🟢 Trạng thái', value: 'Đang online 24/7', inline: true },
                { name: '🔊 Trạng thái Voice', value: connection ? 'Đang treo trong phòng Voice 🟢' : 'Chưa vào phòng thoại ⚪', inline: true },
                { name: '⏱️ Thời gian chạy', value: `${uptimeHours} giờ`, inline: true },
                { name: '💾 RAM tiêu thụ', value: `${memoryMB} MB`, inline: true },
                { name: '🌐 Số máy chủ', value: `${client.guilds.cache.size} server`, inline: true },
                { name: '📶 Ping API', value: `${Math.round(client.ws.ping)}ms`, inline: true }
            )
            .setFooter({ text: 'Treo máy & Voice Discord 24/7' })
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    } 

    // Lệnh /help
    if (commandName === 'help') {
        const embed = new EmbedBuilder()
            .setColor('#3b82f6')
            .setTitle('📖 Danh Sách Lệnh Của Bot')
            .setDescription('Bot hỗ trợ treo máy và treo phòng thoại (Voice) liên tục 24/7:')
            .addFields(
                { name: '`/join`', value: 'Gọi bot vào phòng Voice (bạn đang đứng hoặc chỉ định)' },
                { name: '`/leave`', value: 'Cho bot rời khỏi phòng Voice' },
                { name: '`/ping`', value: 'Kiểm tra tốc độ phản hồi của bot' },
                { name: '`/status`', value: 'Kiểm tra thông số ram, uptime và trạng thái Voice' },
                { name: '`/help`', value: 'Xem danh sách hướng dẫn này' }
            )
            .setFooter({ text: 'Treo máy & Voice Discord 24/7' });

        return interaction.reply({ embeds: [embed] });
    }
});

// Chống crash bot
process.on('unhandledRejection', (reason) => {
    console.error('[Anti-Crash] Lỗi không xử lý:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('[Anti-Crash] Lỗi ngoại lệ:', err);
});

// Đăng nhập
const TOKEN = process.env.DISCORD_TOKEN;
client.login(TOKEN).catch((err) => {
    console.error('[Lỗi Đăng Nhập]', err.message);
});
