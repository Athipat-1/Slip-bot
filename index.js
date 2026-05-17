require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const FormData = require('form-data');
const express = require('express');

const app = express();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ================= WEB SERVER =================

app.get('/', (req, res) => {
    res.send('Slip Bot Online ✅');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Web server running on port ${PORT}`);
});

// ================= DISCORD BOT =================

client.once('clientReady', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// reconnect / debug logs
client.on('disconnect', () => {
    console.log('Bot disconnected');
});

client.on('reconnecting', () => {
    console.log('Bot reconnecting...');
});

client.on('resume', () => {
    console.log('Bot resumed');
});

client.on('error', console.error);

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// heartbeat log ทุก 10 นาที
setInterval(() => {
    console.log("Bot is alive:", new Date().toLocaleString());
}, 600000);

client.on('messageCreate', async (message) => {

    if (message.author.bot) return;

    console.log(`Message from ${message.author.tag}`);

    // เช็คว่ามีรูปไหม
    if (message.attachments.size > 0) {

        const attachment = message.attachments.first();

        const imageUrl = attachment.url;

        await message.reply('🔍 กำลังตรวจสลิป...');

        try {

            // โหลดรูปจาก Discord
            const imageResponse = await axios.get(
                imageUrl,
                {
                    responseType: 'arraybuffer',
                    timeout: 15000
                }
            );

            // สร้าง form-data
            const form = new FormData();

            form.append(
                'file',
                imageResponse.data,
                'slip.jpg'
            );

            // ส่งไป EasySlip
            const response = await axios.post(
                'https://developer.easyslip.com/api/v1/verify',
                form,
                {
                    timeout: 15000,
                    headers: {
                        ...form.getHeaders(),
                        Authorization: `Bearer ${process.env.API_KEY}`
                    }
                }
            );

            console.log(response.data);

            // ดึงข้อมูล
            const data = response.data.data;

            // ข้อมูลสลิป
            const amount = data.amount.amount;
            const time = data.date;
            const payload = data.payload;

            // เลขบัญชีปลายทาง
            const receiverAccount = data.receiver.account.value;

            // กันสลิปซ้ำ
            global.usedSlips = global.usedSlips || [];

            if (global.usedSlips.includes(payload)) {
                return message.reply('❌ สลิปนี้ถูกใช้แล้ว');
            }

            global.usedSlips.push(payload);

            // ตอบกลับ
            message.reply(
`ชำระเงินเรียบร้อย ✅

🏦 บัญชีปลายทาง: ${receiverAccount}
💸 จำนวน: ${amount} บาท
🕒 เวลา: ${time}
🔁 สถานะ: สำเร็จ

ส่ง @username หรือลิ้งค์เซิร์ฟเวอร์ได้เลยครับ`
            );

        } catch (err) {

            console.log(err.response?.data || err.message);
            console.log(err);

            message.reply('❌ ตรวจสอบไม่สำเร็จ');
        }
    }

});

client.login(process.env.TOKEN);