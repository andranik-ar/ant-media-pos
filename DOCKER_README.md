# Ant Media POS Docker Setup

This Docker setup includes both Ant Media Server and the frontend application in a single container.

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Build and start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

### Using Docker directly

```bash
# Build the image
docker build -t antmedia-pos .

# Run the container
docker run -d \
  --name antmedia-pos \
  --privileged \
  -p 5080:5080 \
  -p 5443:5443 \
  -p 1935:1935 \
  -p 5554:5554 \
  -p 3000:3000 \
  antmedia-pos
```

## Access Points

Once the container is running:

- **Frontend Application**: http://localhost:3000
- **Ant Media Server (HTTP)**: http://localhost:5080
- **Ant Media Server (HTTPS)**: https://localhost:5443
- **RTMP Endpoint**: rtmp://localhost:1935/LiveApp
- **WebRTC Endpoint**: ws://localhost:5080/LiveApp/websocket

## Configuration

### License Key
The installation script includes the provided license key: `AMS94f7caac627e314b6b03f0fae35f20`

### JWT Configuration
The installer automatically adds JWT configuration to `/usr/local/antmedia/conf/red5.properties`:
```properties
# added automatically by ando
server.jwtServerControlEnabled=true
server.jwtServerSecretKey=your-secret-key-at-least-32-character
```

## What's Included

1. **Ant Media Server** - Full installation with license key
2. **Node.js 18** - For frontend application
3. **Yarn** - Package manager
4. **Frontend Build** - Production build of React application
5. **Systemd Service** - For Ant Media Server management
6. **Automatic Service Restart** - Restarts antmedia service on startup

## Development

For development, you can mount the frontend directory:

```bash
docker run -d \
  --name antmedia-pos-dev \
  --privileged \
  -p 5080:5080 \
  -p 5443:5443 \
  -p 1935:1935 \
  -p 5554:5554 \
  -p 3000:3000 \
  -v ./front:/opt/frontend \
  antmedia-pos
```

## Troubleshooting

### Container won't start
Ensure Docker is running with privileged access:
```bash
sudo systemctl restart docker
```

### Service not accessible
Check container logs:
```bash
docker-compose logs antmedia-pos
```

### Frontend not working
The frontend is built during container creation. If you make changes:
```bash
# Rebuild and restart
docker-compose up --build -d
```

## Data Persistence

All Ant Media Server data is persisted in a Docker volume named `antmedia_data`. To backup:
```bash
docker run --rm -v antmedia_data:/data -v $(pwd):/backup ubuntu tar czf /backup/antmedia-backup.tar.gz -C /data .
```

## Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 3000 | HTTP | Frontend Application |
| 5080 | HTTP | Ant Media Server |
| 5443 | HTTPS | Ant Media Server (SSL) |
| 1935 | RTMP | RTMP Streaming |
| 5554 | WebSocket | WebRTC Streaming |