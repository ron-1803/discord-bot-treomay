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
    Events 
} = require('discord.js');

// 1. Tạo Web Server nhỏ để dịch vụ Cloud (Render, Koyeb, Uptimerobot) ping giữ kết nối 24/7
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
                <h1 style="font-size: 1.6rem; margin-top: 0;">🤖 Bot Treo Máy 24/7</h1>
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

// 2. Khởi tạo Discord Bot Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
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
        .setName('help')
        .setDescription('Xem danh sách hướng dẫn lệnh')
].map(command => command.toJSON());

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
        console.log('[Slash Commands] Đã đăng ký thành công các lệnh (/ping, /status, /help)');
    } catch (err) {
        console.error('[Slash Commands Error]', err.message);
    }

    // Cài đặt trạng thái hoạt động (Status / Presence)
    const updatePresence = () => {
        c.user.setPresence({
            activities: [{
                name: '🟢 Treo máy 24/7 | /help',
                type: ActivityType.Custom
            }],
            status: 'online'
        });
    };

    updatePresence();
    setInterval(updatePresence, 15 * 60 * 1000); // Lặp lại định kỳ mỗi 15 phút
});

// Xử lý Slash Commands (Tương tác /ping, /status, /help)
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'ping') {
        const ping = Date.now() - interaction.createdTimestamp;
        const apiPing = Math.round(client.ws.ping);
        await interaction.reply(`🏓 **Pong!**\n- Độ trễ tin nhắn: \`${ping}ms\`\n- Độ trễ Discord API: \`${apiPing}ms\``);
    } 
    else if (commandName === 'status') {
        const uptimeHours = (process.uptime() / 3600).toFixed(2);
        const memoryMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

        const embed = new EmbedBuilder()
            .setColor('#22c55e')
            .setTitle('📊 Trạng Thái Bot Treo Máy 24/7')
            .addFields(
                { name: '🟢 Trạng thái', value: 'Đang online 24/7', inline: true },
                { name: '⏱️ Thời gian chạy', value: `${uptimeHours} giờ`, inline: true },
                { name: '💾 RAM tiêu thụ', value: `${memoryMB} MB`, inline: true },
                { name: '🌐 Số máy chủ', value: `${client.guilds.cache.size} server`, inline: true },
                { name: '📶 Ping API', value: `${Math.round(client.ws.ping)}ms`, inline: true }
            )
            .setFooter({ text: 'Treo máy Discord 24/7 Cloud' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    } 
    else if (commandName === 'help') {
        const embed = new EmbedBuilder()
            .setColor('#3b82f6')
            .setTitle('📖 Danh Sách Lệnh Của Bot')
            .setDescription('Bot đang được duy trì trực tuyến liên tục.')
            .addFields(
                { name: '`/ping`', value: 'Kiểm tra tốc độ phản hồi của bot' },
                { name: '`/status`', value: 'Kiểm tra thông số ram, uptime và máy chủ' },
                { name: '`/help`', value: 'Xem danh sách hướng dẫn này' }
            )
            .setFooter({ text: 'Treo máy Discord 24/7 Cloud' });

        await interaction.reply({ embeds: [embed] });
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
