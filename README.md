# Object.disarray()

The ultimate "Answer Engine" designed for extreme backwards compatibility (Mac OS 9 / IE5) and modern AI agentic power.

## Features
- **Smart Summarization**: Uses GPT models to distill web content into readable summaries.
- **Agentic Browsing**: Uses a separate LLM pass to "find" the best source URL for your query.
- **Media Extraction**: Uses `yt-dlp` to get direct stream links from YouTube.
- **Ancient Support**: Uses HTML 4.01 and Table-based layouts to ensure a beautiful experience on PowerMac G4s.

## Setup
1. Ensure `yt-dlp` is installed on your server (`sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && sudo chmod a+rx /usr/local/bin/yt-dlp`).
2. Run `npm install`.
3. Set your API keys in `.env`.
4. Run `node index.js`.
