# Action Fitness Desktop

Desktop application for fitness class control with video playback, MQTT light control, and audio streaming.

## Features

- **Video Autoplay**: No browser restrictions - videos play automatically
- **MQTT Control**: AWS IoT Core + Shiftr.io for light/load control
- **Audio Streaming**: MP3 playback from backend API URLs
- **Cross-platform**: Windows and macOS support

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file based on `.env.example`:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Development mode:
```bash
npm run dev
# In another terminal:
npm start
```

4. Build for production:
```bash
# macOS
npm run dist:mac

# Windows
npm run dist:win
```

## Configuration

Environment variables (`.env`):

- `VITE_API_BASE_URL` - Backend API URL
- `AWS_IOT_ENDPOINT` - AWS IoT Core endpoint
- `AWS_REGION` - AWS region (default: us-west-2)
- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret key
- `SHIFTR_USERNAME` - Shiftr.io username
- `SHIFTR_PASSWORD` - Shiftr.io password

## Architecture

```
Main Process (Node.js)
├── MqttManager - AWS IoT + Shiftr.io MQTT
├── AudioEngine - Howler.js MP3 playback
└── IPC Handlers - Bridge to renderer

Renderer Process (React)
├── Home - Login, room selection, countdown
├── Routine - Exercise display, video, timer
└── Stores - Zustand state management
```

## Room Types Supported

- Savage
- Tonic/Solido
- Jab
- Stride
- Giro
- Buum
- Lestrois
- Beats
- Level

## Building Installers

The app uses electron-builder for packaging:

```bash
# Build for current platform
npm run dist

# Build for specific platform
npm run dist:mac
npm run dist:win
```

Output is in the `release/` directory.
