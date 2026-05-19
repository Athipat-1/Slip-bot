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

// heartbeat log ทุก 10 นาที
setInterval(() => {
    console.log("Bot is alive:", new Date().toLocaleString());
}, 600000);

// กันสลิปซ้ำ
global.usedSlips = [];

client.on('messageCreate', async (message) => {

    if (message.author.bot) return;

    console.log(`Message from ${message.author.tag}`);

    // เช็คว่ามีรูปไหม
    if (message.attachments.size > 0) {

        const attachment = message.attachments.first();

        const imageUrl = attachment.url;

        await message.reply('🔍 กำลังตรวจสลิป...');

        try {

            // โหลดรูป
            const imageResponse = await axios.get(
                imageUrl,
                {
                    responseType: 'arraybuffer',
                    timeout: 15000
                }
            );

            let response;
            let slipType = 'ธนาคาร';

            // ================= ตรวจธนาคาร =================

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

                console.log('Bank Slip');

            } catch {

                // ================= ตรวจ TrueMoney =================

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

                console.log('TrueMoney Slip');
            }

            console.log(response.data);

            // ================= ดึงข้อมูล =================

            const data = response.data.data;

            const amount =
                data.amount?.amount || data.amount || 'ไม่พบข้อมูล';

            const time =
                data.date || 'ไม่พบข้อมูล';

            const payload =
                data.payload ||
                data.transactionId ||
                'unknown';

            // กันสลิปซ้ำ
            if (global.usedSlips.includes(payload)) {

                return message.reply(
`\`\`\`yaml
❌ SLIP DUPLICATE

Status : Rejected
Reason : This slip has already been used
\`\`\``
                );
            }

            global.usedSlips.push(payload);

            // ข้อมูลผู้รับ
            const receiverAccount =
                data.receiver?.account?.value || '-';

            const receiverName =
                data.receiver?.name || '-';

            const receiverPhone =
                data.receiver?.phone || '-';

            // ================= ตอบกลับ =================

            message.reply(
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

            message.reply(
`\`\`\`yaml
❌ VERIFY FAILED

Status : Failed
Reason : Unable to verify slip
\`\`\``
            );
        }
    }

});

client.login(process.env.TOKEN);