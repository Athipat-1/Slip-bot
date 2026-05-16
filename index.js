require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const FormData = require('form-data');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('clientReady', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {

    if (message.author.bot) return;

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
                    responseType: 'arraybuffer'
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

            message.reply('❌ ตรวจสอบไม่สำเร็จ');
        }
    }

});

// heartbeat log ทุก 10 นาที
setInterval(() => {
    console.log("Bot is alive:", new Date().toLocaleString());
}, 600000);

client.login(process.env.TOKEN);