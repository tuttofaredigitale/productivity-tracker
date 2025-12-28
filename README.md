# 🚀 Productivity Tracker

A lightweight, privacy-focused desktop app to track your productivity across projects. Built with **Tauri** (Rust + Web) for minimal resource usage (~30-50MB RAM vs ~300MB for Electron apps).

![Screenshot](docs/screenshot.png)

## ✨ Features

- ⏱️ **Pomodoro Timer** - Configurable work sessions (25/50 min) and breaks (5/15 min), or free mode
- 🎯 **Project-based Tracking** - Organize time by project with custom colors
- ⏸️ **Pause & Resume** - Pause your timer without losing progress
- 📊 **Visual Analytics** - Hourly, daily, and weekly charts with project distribution
- 🤖 **AI Insights** - Get personalized productivity suggestions (supports Anthropic, OpenAI, Groq, Ollama)
- ☁️ **AWS Sync** - Automatic cloud backup via S3 + Lambda + API Gateway
- 🎵 **Focus Music** - Built-in streaming radio with Lo-Fi, Jazz, Ambient, Synthwave channels
- 🔒 **Privacy First** - All data stored locally, you control what syncs to cloud
- 🪶 **Lightweight** - Uses native OS webview, not Chromium

## 📦 Installation

#### Prerequisites

1. **Rust** (1.70+)

   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **System Dependencies**

   **Ubuntu/Debian:**

   ```bash
   sudo apt update
   sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
   ```

   **Fedora:**

   ```bash
   sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file libappindicator-gtk3-devel librsvg2-devel
   ```

   **macOS:**

   ```bash
   xcode-select --install
   ```

   **Windows:**

   - Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
   - Install [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

3. **Tauri CLI**
   ```bash
   cargo install tauri-cli
   ```

#### Build

```bash
# Clone the repository
git clone https://github.com/tuttofaredigitale/productivity-tracker.git
cd productivity-tracker

# Development mode (hot reload)
cargo tauri dev

# Production build
cargo tauri build
```

The compiled app will be in `src-tauri/target/release/bundle/`.

## 🎮 Usage

### Pomodoro Timer

1. **Select a timer mode** at the top:
   - `25 min` / `50 min` - Work sessions (countdown)
   - `5 min ☕` / `15 min ☕` - Break sessions (start immediately)
   - `Free ∞` - No limit, counts up
2. **Click Start** on a project to begin
3. **Pause/Resume** anytime without losing progress
4. **Stop & Save** to end the session
5. Get notified when your Pomodoro ends 🍅

### Projects

- Click **+ New** to add a project
- Each project has a custom color for easy identification
- Track time per project separately
- Delete projects with the trash icon

### Analytics

- **Hourly Chart**: See your productivity distribution today
- **Weekly Chart**: Daily trend over the last 7 days
- **Project Pie Chart**: Time distribution by project (shows minutes if < 1 hour)

### AI Insights

Get personalized productivity analysis based on your data:

1. Go to **AI Insights** tab
2. Select your preferred AI provider:
   - **Anthropic (Claude)** - Recommended
   - **OpenAI (GPT-4)**
   - **Groq** - Fast, has free tier
   - **Ollama** - Local, no API key needed
3. Enter your API key (click `?` for docs)
4. Click **Generate AI Suggestions**

The AI analyzes your last 30 days of data from AWS and provides:

- Identified productivity patterns
- Personalized suggestions
- Work/break balance analysis
- Concrete action items

### Focus Music 🎵

Built-in streaming radio to help you focus:

1. Click the **purple music button** (bottom-right)
2. Select a station:
   - 🎧 Lo-Fi & Chill
   - 🌿 Ambient Groove
   - 🌌 Space Ambient
   - 🔮 Drone Zone
   - 🎷 Jazz Lounge
   - 🌆 Synthwave
   - 🌧️ Ambient World
3. Adjust volume with the slider
4. Button turns **green** when music is playing

Powered by [SomaFM](https://somafm.com/) - commercial-free, listener-supported radio.

### AWS Sync

- Click **Sync** to manually upload today's data to AWS
- Auto-sync runs every 5 minutes (configurable)
- Data is stored as JSON files in S3: `daily-logs/YYYY-MM-DD.json`

## ⌨️ Keyboard Shortcuts

| Shortcut       | Action            |
| -------------- | ----------------- |
| `Ctrl/Cmd + S` | Sync to AWS       |
| `Escape`       | Stop active timer |

## 🗂️ Data Storage

### Local Storage

Data is stored locally in your system's app data directory:

- **Windows**: `C:\Users\<user>\AppData\Roaming\productivity-tracker\`
- **macOS**: `~/Library/Application Support/productivity-tracker/`
- **Linux**: `~/.local/share/productivity-tracker/`

Files:

- `projects.json` - Your projects list
- `sessions.json` - All tracked sessions

### Cloud Storage (AWS S3)

When synced, data is stored in S3:

```
s3://your-bucket/
└── daily-logs/
    ├── 2025-12-27.json
    ├── 2025-12-28.json
    └── ...
```

## ☁️ AWS Integration

The app uses a serverless architecture for cloud sync:

```
App → API Gateway → Lambda → S3
```

### Quick Setup

1. **Create S3 Bucket**

   ```bash
   aws s3 mb s3://your-productivity-tracker --region eu-central-1
   aws s3api put-bucket-versioning --bucket your-productivity-tracker --versioning-configuration Status=Enabled
   ```

2. **Create Lambda Function** (see `lambda-function.js` in repo)

3. **Create API Gateway HTTP API** with routes:

   - `POST /sync` - Save daily data
   - `GET /sync?date=YYYY-MM-DD` - Get single day
   - `GET /sync?from=YYYY-MM-DD&to=YYYY-MM-DD` - Get date range

4. **Update `src/config.js`** with your API endpoint:
   ```javascript
   API_URL: "https://your-api-id.execute-api.eu-central-1.amazonaws.com/prod";
   ```

### Estimated AWS Costs

| Service     | Monthly Usage      | Cost             |
| ----------- | ------------------ | ---------------- |
| S3          | < 100 MB           | ~$0.01           |
| Lambda      | ~1,500 invocations | Free tier        |
| API Gateway | ~1,500 requests    | ~$0.01           |
| **Total**   |                    | **~$0.02/month** |

_First year is essentially free with AWS Free Tier._

## 🔧 Configuration

1. Copy the example config:

   ```bash
   cp src/config.example.js src/config.js
   ```

2. Edit `src/config.js` with your settings:

```javascript
const CONFIG = {
  // Your AWS API endpoint
  API_URL: "https://your-api.execute-api.region.amazonaws.com/prod",

  // Auto-sync interval (minutes, 0 = disabled)
  AUTO_SYNC_INTERVAL: 5,

  // Minimum session duration to save (seconds)
  MIN_SESSION_DURATION: 60,

  // Default pomodoro (seconds)
  DEFAULT_POMODORO: 25 * 60,

  // Debug logging
  DEBUG: false,
};
```

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Ideas for Contributions

- [ ] Dark/Light theme toggle
- [ ] Export to CSV/PDF
- [ ] Keyboard shortcuts for project switching
- [ ] Weekly goals and streaks
- [ ] Desktop notifications improvements
- [ ] Localization (i18n)

## 📄 License

MIT License - see [LICENSE](LICENSE) file.

## 🙏 Acknowledgments

- [Tauri](https://tauri.app/) - For the amazing lightweight framework
- [Chart.js](https://www.chartjs.org/) - For beautiful charts
- [SomaFM](https://somafm.com/) - For free streaming radio
- [Anthropic](https://anthropic.com/), [OpenAI](https://openai.com/), [Groq](https://groq.com/), [Ollama](https://ollama.ai/) - For AI APIs

---

## 📚 Want to learn how to build cloud-native apps?

This app is a practical example of AWS integration with S3, Lambda, and API Gateway.

If you want to master AWS cloud services:

👉 **[Alessio Ferrari Cloud Academy](https://alessioferrari.net/academy/)**

Italian courses for IT professionals who want to master AWS cloud.

---

Made with ☕ by Alessio Ferrari
