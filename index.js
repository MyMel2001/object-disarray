require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const path = require('path');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// AI Config
const aiClient = axios.create({
    baseURL: process.env.AI_BASE_URL,
    headers: { 'Authorization': `Bearer ${process.env.AI_API_KEY}` }
});

// Logic to intelligently generate a query if user is vague
async function getSmartQuery(input) {
    if (!input || input.length < 3) {
        const res = await aiClient.post('/chat/completions', {
            model: process.env.SUMMARY_MODEL,
            messages: [{ role: 'system', content: 'Generate a random, interesting research topic query.' }]
        });
        return res.data.choices[0].message.content;
    }
    return input;
}

// The "Agent" logic to find a relevant source
async function getTargetUrl(query) {
    const res = await aiClient.post('/chat/completions', {
        model: process.env.AGENT_MODEL,
        messages: [{ 
            role: 'system', 
            content: 'You are an agent. Return ONLY a URL that would best answer this query. Use Wikipedia, YouTube, or news sites.' 
        }, { role: 'user', content: query }]
    });
    return res.data.choices[0].message.content.trim();
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.post('/ask', async (req, res) => {
    try {
        const userQuery = await getSmartQuery(req.body.query);
        const targetUrl = await getTargetUrl(userQuery);

        // Fetch and Extract Content
        const webRes = await axios.get(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const dom = new JSDOM(webRes.data, { url: targetUrl });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();

        // Summarize Smartly
        const summaryRes = await aiClient.post('/chat/completions', {
            model: process.env.SUMMARY_MODEL,
            messages: [{ 
                role: 'system', 
                content: 'Summarize this content. If it mentions music or video, mention it clearly.' 
            }, { role: 'user', content: article.textContent.substring(0, 5000) }]
        });

        const summary = summaryRes.data.choices[0].message.content;

        // Construct a legacy-friendly response
        // Note: For IE5, we use a simple template literal sent as HTML
        res.send(`
            <html>
            <head>
                <title>Object.disarray() - Result</title>
                <link rel="stylesheet" href="/style.css">
            </head>
            <body bgcolor="#ffffff">
                <table width="100%" border="0" cellpadding="20">
                    <tr><td>
                        <font face="Verdana, Arial, Helvetica" size="4"><b>Query:</b> ${userQuery}</font><br>
                        <font face="Verdana, Arial, Helvetica" size="2">Source: ${targetUrl}</font>
                        <hr noshade size="1">
                        <div class="summary-box">
                            <font face="Verdana, Arial, Helvetica" size="3">${summary}</font>
                        </div>
                        ${targetUrl.includes('youtube.com') ? 
                            `<iframe width="420" height="315" src="https://www.youtube.com/embed/${targetUrl.split('v=')[1]}"></iframe>` 
                            : ''}
                        <p><a href="/">[ Back to Search ]</a></p>
                    </td></tr>
                </table>
            </body>
            </html>
        `);
    } catch (err) {
        res.send("Error: " + err.message);
    }
});

app.listen(process.env.PORT || 3000, () => console.log('Object.disarray() live on port 3000'));
