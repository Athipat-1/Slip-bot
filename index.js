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

// reconnect logs
client.on('disconnect', () => {
    console.log('Bot disconnected');
});

client.on('resume', () => {
    console.log('Bot resumed');
});

client.on('error', console.error);

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// heartbeat ทุก 10 นาที
setInterval(() => {
    console.log("Bot is alive:", new Date().toLocaleString());
}, 600000);

// กันสลิปซ้ำ
global.usedSlips = [];

client.on('messageCreate', async (message) => {

    // ข้ามข้อความบอท
    if (message.author.bot) return;

    // ใช้เฉพาะคำว่า checkS
    if (message.content.toLowerCase().trim() !== 'checks') return;

    // ลบข้อความ command
    await message.delete().catch(() => {});

    try {

        // ดึงข้อความล่าสุด 10 ข้อความ
        const messages = await message.channel.messages.fetch({ limit: 10 });

        let attachment = null;

        // หา "รูปล่าสุด"
        for (const msg of messages.values()) {

            // ข้ามข้อความบอท
            if (msg.author.bot) continue;

            // ข้ามข้อความ checks
            if (msg.content.toLowerCase().trim() === '!c') continue;

            // ถ้ามีรูป
            if (msg.attachments.size > 0) {

                attachment = msg.attachments.first();
                break;
            }
        }

        // ไม่เจอรูป
        if (!attachment) {

            return message.channel.send(
`\`\`\`yaml
❌ VERIFY FAILED

Reason : No image found
\`\`\``
            );
        }

        // เช็คว่าเป็นรูปไหม
        if (!attachment.contentType?.startsWith('image/')) {

            return message.channel.send(
`\`\`\`yaml
❌ VERIFY FAILED

Reason : File is not an image
\`\`\``
            );
        }

        const imageUrl = attachment.url;

        await message.channel.send('🔍 กำลังตรวจสลิป...');

        // โหลดรูปจาก Discord
        const imageResponse = await axios.get(
            imageUrl,
            {
                responseType: 'arraybuffer',
                timeout: 15000
            }
        );

        let response;
        let slipType = 'Bank Slip';

        // ================= ตรวจสลิปธนาคาร =================

        try {

            const form = new FormData();

            form.append(
                'file',
                imageResponse.data,
                'slip.jpg'
            );

            response = await axios.post(
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

            console.log('Bank Slip Verified');

        } catch {

            // ================= ตรวจ TrueMoney Wallet =================

            const form = new FormData();

            form.append(
                'file',
                imageResponse.data,
                'slip.jpg'
            );

            response = await axios.post(
                'https://developer.easyslip.com/api/v1/verify/truewallet',
                form,
                {
                    timeout: 15000,
                    headers: {
                        ...form.getHeaders(),
                        Authorization: `Bearer ${process.env.API_KEY}`
                    }
                }
            );

            slipType = 'TrueMoney Wallet';

            console.log('TrueMoney Slip Verified');
        }

        console.log(response.data);

        // ================= ดึงข้อมูล =================

        const data = response.data.data;

        const amount =
            data.amount?.amount ||
            data.amount ||
            'Unknown';

        const time =
            data.date ||
            'Unknown';

        const payload =
            data.payload ||
            data.transactionId ||
            'unknown';

        // ================= กันสลิปซ้ำ =================

        if (global.usedSlips.includes(payload)) {

            return message.channel.send(
`\`\`\`yaml
❌ SLIP DUPLICATE

Status : Rejected
Reason : This slip has already been used
\`\`\``
            );
        }

        global.usedSlips.push(payload);

        // ================= ข้อมูลผู้รับ =================

        const receiverAccount =
            data.receiver?.account?.value || '-';

        const receiverName =
            data.receiver?.name || '-';

        const receiverPhone =
            data.receiver?.phone || '-';

        // ================= ตอบกลับ =================

        message.channel.send(
`\`\`\`yaml
PAYMENT SUCCESS ✅

Type        : ${slipType}

Receiver    : ${receiverName}
Phone       : ${receiverPhone}
Account     : ${receiverAccount}

Amount      : ${amount} บาท
Time        : ${time}

Status      : Success
Duplicate   : No
\`\`\`

ส่ง @username หรือลิ้งค์เซิร์ฟเวอร์ได้เลยครับ`
        );

    } catch (err) {

        console.log(err.response?.data || err.message);

        message.channel.send(
`\`\`\`yaml
❌ VERIFY FAILED

Status : Failed
Reason : Unable to verify slip
\`\`\``
        );
    }

});

client.login(process.env.TOKEN);