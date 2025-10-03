# JAAK KYC Mosaic Integration Example

A complete implementation example for integrating JAAK Mosaic KYC verification in web applications using iframe embedding.

## Features

- 🔒 Secure iframe integration with camera/microphone permissions
- ⚙️ Dynamic KYC flow configuration
- 💾 Persistent configuration management
- 📊 Real-time progress tracking and data capture
- 🎨 Modern responsive UI with two-column layout

## Quick Start

### Prerequisites

- Node.js 18+
- JAAK Mosaic API credentials

### Installation

1. Clone and install dependencies:
```bash
git clone https://github.com/soyYisus/jaak-kyc-mosaic-usage-example
cd kyc-embebido
cd backend && npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your JAAK API credentials
```

3. Start the server:
```bash
npm start
```

4. Open your browser:
```
http://localhost:3000
```

## Configuration

Edit `backend/.env`:
- `JAAK_BEARER_TOKEN`: Your JAAK API bearer token
- `JAAK_API_URL`: JAAK API endpoint (sandbox/production)
- `PORT`: Server port (default: 3000)

## Usage

1. Click "Obtener Nuevo Short Key" to generate a session
2. Select desired KYC steps
3. Click "Guardar Cambios" to persist configuration
4. Click "Iniciar Flujo KYC" to start verification
5. Monitor progress and captured data in real-time

## Project Structure

```
├── backend/           # Express.js server
│   ├── server.js     # Main server file
│   ├── .env          # Environment configuration
│   └── config.json   # Persistent KYC configuration
├── frontend/         # Static web files
│   ├── index.html    # Main interface
│   ├── styles/       # CSS styling
│   └── scripts/      # JavaScript logic
└── docs/            # Documentation
```
## Docs

Follow the link to get more details: [JAAK Docs](https://docs.jaak.ai/docs/kyc-embebido-con-jaak-mosaic#/)

## License

MIT License