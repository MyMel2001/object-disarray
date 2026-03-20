require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const ytdl = require('yt-dlp-exec');
const path = require('path');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const aiClient = axios.create({
    baseURL: process.env.AI_BASE_URL,
    headers: { 'Authorization': `Bearer ${process.env.AI_API_KEY}` }
});

// Helper: Get direct media URL via yt-dlp
async function getMediaStream(url) {
    try {
        const output = await ytdl(url, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            addHeader: ['referer:youtube.com', 'user-agent:googlebot']
        });
        // Returns the best single file URL (often a combined format)
        return output.url || output.formats.reverse().find(f => f.url).url;
    } catch (e) {
        console.error("Media extraction failed:", e.message);
        return null;
    }
}

// Helper: Smart Query Generator
async function getSmartQuery(input) {
    if (!input || input.trim().length < 2) {
        const res = await aiClient.post('/chat/completions', {
            model: process.env.SUMMARY_MODEL,
            messages: [{ role: 'system', content: `Generate a creative, specific research query about ${input}. Output ONLY the query.` }]
        });
        return res.data.choices[0].message.content;
    }
    return input;
}

app.post('/ask', async (req, res) => {
    try {
        const userQuery = await getSmartQuery(req.body.query);
        
        // Agent: Find the best URL
        const agentRes = await aiClient.post('/chat/completions', {
            model: process.env.AGENT_MODEL,
            messages: [{ 
                role: 'system', 
                content: 'You are a web agent. Find the most authoritative URL (Wikipedia for general wiki-style knowledge, YouTube for music/video, Merriam Webster for definitions, official webpage/webpages for products, etc.) to answer the user. Return ONLY the URL.' 
            }, { role: 'user', content: userQuery }]
        });
        const targetUrl = agentRes.data.choices[0].message.content.trim();

        // Extraction
        const webRes = await axios.get(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const dom = new JSDOM(webRes.data, { url: targetUrl });
        const reader = new Readability(dom.window.document);
        const article = reader.parse() || { textContent: "No readable text found.", title: "Source" };

        // Media Logic
        let directMediaUrl = null;
        let isVideo = targetUrl.includes('youtube.com') || targetUrl.includes('youtu.be');
        
        if (isVideo) {
            directMediaUrl = await getMediaStream(targetUrl);
        }

        // Summary Agent
        const summaryRes = await aiClient.post('/chat/completions', {
            model: process.env.SUMMARY_MODEL,
            messages: [{ 
                role: 'system', 
                content: 'Summarize the following content smartly. Use bullet points for key facts. If media is present, describe why it is relevant.' 
            }, { role: 'user', content: `Title: ${article.title}\n\nContent: ${article.textContent.substring(0, 4000)}` }]
        });
        const summaryHtml = summaryRes.data.choices[0].message.content.replace(/\n/g, '<br>');

        // IE5 Compatible Response Construction
        res.send(`
            <!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
            <html>
            <head>
                <title>Object.disarray() - Result</title>
                <style>
                    body { font-family: "Verdana", sans-serif; background: #fff; color: #333; margin: 20px; }
                    .container { width: 95%; max-width: 800px; margin: auto; }
                    .summary { background: #f4f4f4; border: 1px solid #ccc; padding: 15px; margin-top: 10px; }
                    .media-box { background: #000; color: #fff; padding: 10px; margin: 15px 0; text-align: center; }
                    a { color: #0066cc; }
                </style>
            </head>
            <body>
                <div class="container">
                    <table width="100%" border="0" cellspacing="0" cellpadding="10">
                        <tr>
                            <td>
                                <b><font size="5">Object.disarray()</font></b><br>
                                <font size="2"><b>Source:</b> <a href="${targetUrl}">${targetUrl}</a></font>
                                <hr noshade size="1">
                                <div class="summary">
                                    <font size="3">${summaryHtml}</font>
                                </div>
                                ${directMediaUrl ? `
                                    <div class="media-box">
                                        <font size="2"><b>Direct Media Link (yt-dlp Extracted):</b></font><br>
                                        <a href="${directMediaUrl}" style="color:#00ff00;">[ Download / Open in Player ]</a><br>
                                        <font size="1">Targeting YouTube stream for copyright compliance.</font>
                                    </div>
                                ` : ''}
                                <p align="center"><a href="/">[ New Search ]</a></p>
                            </td>
                        </tr>
                    </table>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        res.status(500).send("System Error: " + err.message);
    }
});

app.listen(process.env.PORT || 3000, () => console.log('Object.disarray() running...'));
