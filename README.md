# 🎬 WatchTogether

A synchronized movie watching app for two people. Load your local video files and watch in perfect sync with real-time camera, chat, and emoji reactions.

## ✨ Features

- **Local Video Playback** — Pick video files from your device (MP4, WebM, MOV). No upload to any server.
- **Real-Time Sync** — Play, pause, seek, and speed changes sync between both viewers within <200ms.
- **Camera Bubbles** — Floating, draggable WebRTC camera bubbles overlaid on the video. Click to expand.
- **Chat** — Collapsible chat panel that slides in as an overlay.
- **Emoji Reactions** — Send flying emoji reactions visible to both users.
- **Room System** — Create a room, share the 6-character code, and start watching.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm

### Setup

```bash
# 1. Install server dependencies
cd server
npm install

# 2. Install client dependencies
cd ../client
npm install

# 3. Start the server (from /server)
cd ../server
npm run dev

# 4. Start the client (from /client, in another terminal)
cd ../client
npm run dev
```

### Usage

1. Open `http://localhost:5173` in two browser tabs
2. Tab 1: Enter a name → Click "Create Room"
3. Tab 2: Enter a name → Enter the room code → Click "Join Room"
4. Both tabs: Select the same video file from your device
5. Play, pause, or seek in either tab — it syncs to the other!

## 🎨 Design

- Dark cinema theme with violet (#7C3AED) and cyan (#06B6D4) accents
- Frosted glass overlays
- Spring-physics animations via Framer Motion
- Auto-hiding controls with cursor hiding in fullscreen
- Responsive: desktop, tablet, and mobile

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space / K | Play / Pause |
| ← / → | Seek -10s / +10s |
| ↑ / ↓ | Volume up / down |
| F | Toggle fullscreen |
| M | Toggle mute |

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Framer Motion |
| Backend | Node.js, Express, Socket.io |
| Video | HTML5 `<video>` with local File API |
| Camera | WebRTC via simple-peer |
| Sync | Socket.io real-time events |

## 📁 Project Structure

```
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/      # UI components
│   │   ├── hooks/           # Custom React hooks
│   │   └── utils/           # Constants & helpers
│   └── ...config files
├── server/                  # Node.js backend
│   ├── index.js             # Express + Socket.io
│   └── roomManager.js       # In-memory room state
└── README.md
```

## ⚠️ Notes

- **MKV/AVI**: HTML5 video doesn't natively support MKV or AVI in most browsers. Use MP4 or WebM for best compatibility.
- **Camera Access**: Requires HTTPS in production (localhost works for development).
- **TURN Server**: WebRTC uses free STUN servers. Connections behind strict firewalls may need a TURN server.

## 🚢 Deployment

### Backend (Railway/Render)
1. Push the `server/` directory
2. Set start command: `node index.js`
3. Set `PORT` environment variable if needed
4. Note the deployed URL

### Frontend (Vercel/Netlify)
1. Push the `client/` directory
2. Set build command: `npm run build`
3. Set output directory: `dist`
4. Set env variable: `VITE_SERVER_URL=https://your-backend-url.com`

## 📄 License

MIT
