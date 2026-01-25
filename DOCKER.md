# PacketView Docker Setup

This document explains how to build and run PacketView using Docker.

## Quick Start

### Using Docker Compose (Recommended)

```bash
docker-compose up -d
```

This will start PacketView on port 3001 with auto-capture disabled using host networking to access real network interfaces.

### Using Docker Directly

```bash
# Build image
docker build -t packetview:latest .

# Run with host networking and root (required for packet capture)
docker run -d \
  --name packetview \
  --network host \
  --user "0:0" \
  --cap-add=NET_ADMIN \
  --cap-add=NET_RAW \
  -e DISABLE_AUTO_CAPTURE=false \
  packetview:latest
```

## Configuration

### Environment Variables

- `NODE_ENV`: Set to `production` (default in Docker)
- `DISABLE_AUTO_CAPTURE`: Set to `true` to disable automatic packet capture on startup (recommended for containers)
- `PORT`: Backend port (default: 3001)

### Network Configuration

PacketView requires special network configuration for packet capture:

**Host Networking (Required)**
- Use `--network host` or `network_mode: host` in docker-compose
- This allows the container to access the host's real network interfaces
- Without host networking, container only sees Docker virtual interfaces

**User and Capabilities**

Two approaches for tcpdump permissions:

1. **Root User (Simple & Secure)**
   ```yaml
   # docker-compose.yml
   user: "0:0"  # Run as root
   ```
   - tcpdump automatically has required capabilities
   - Default configuration in docker-compose.yml

2. **Non-root with setcap (Advanced)**
   - Use alternative service `packetview-nonroot` in docker-compose.yml
   - Dockerfile sets capabilities on tcpdump binary: `setcap cap_net_raw,cap_net_admin=eip /usr/sbin/tcpdump`
   - More secure but requires proper capability configuration

**Network Capabilities (Always Required)**
- `NET_ADMIN`: Required for network interface operations
- `NET_RAW`: Required for raw packet access

### Ports

**Note**: When using host networking, port mapping is not needed. The application binds directly to host ports.

- `3001`: Main application port (HTTP + WebSocket)
- `8080`: Alternative HTTP port  
- `5173`: Development port (Vite)

## Health Check

The container includes a health check that verifies the `/health` endpoint. Container status can be checked with:

```bash
docker ps  # Look for "(healthy)" status
curl http://localhost:3001/health  # Manual health check
```

## Architecture

The Dockerfile uses a multi-stage build:

1. **Backend Builder**: Compiles TypeScript backend
2. **Frontend Builder**: Builds Vite frontend application  
3. **Production**: Minimal runtime image with compiled assets

### Security Features

- Runs as non-root user (nodejs:1001)
- Minimal Alpine Linux base image
- Only production dependencies in final image
- Health check monitoring
- Automatic restart policy

## Accessing the Application

Once running, access PacketView at:
- Web UI: http://localhost:3001
- API: http://localhost:3001/api/
- WebSocket: ws://localhost:3001/ws

## Security Considerations

**Host Networking Implications**
- Host networking gives the container full access to the host network stack
- Consider network isolation requirements for your environment
- May conflict with other services using the same ports
- Monitor network traffic for security auditing

**Production Deployment**

For production use, consider:

1. **Network Security**: Evaluate if host networking is acceptable in your environment
2. **SSL/TLS Termination**: Set up reverse proxy with HTTPS
3. **Port Conflicts**: Ensure no other services conflict with port 3001
4. **Environment Variables**: Configure appropriate production settings
5. **Monitoring**: Set up log monitoring and health checks

### Example with Nginx Proxy

Uncomment the nginx section in `docker-compose.yml` and create an `nginx.conf` file to add SSL/TLS and load balancing.

## Troubleshooting

### Permission Denied Errors

If you see packet capture permission errors, ensure the container has:

1. **Host Networking**: Required to access real network interfaces
   ```bash
   docker run --network host ...
   ```

2. **Root User**: Required for tcpdump to have proper permissions
   ```bash
   docker run --user "0:0" ...
   ```

3. **Network Capabilities**: Required for packet operations
   ```bash
   docker run --cap-add=NET_ADMIN --cap-add=NET_RAW ...
   ```

4. **All Three Required**: Packet capture needs host networking + root + capabilities
   - The Dockerfile sets `setcap` on tcpdump as alternative to root

### Health Check Failures

Check if the application is responding:

```bash
docker logs packetview
curl -v http://localhost:3001/health
```

### Frontend Not Loading

Verify the frontend build completed successfully:

```bash
docker exec -it packetview ls -la /app/frontend/dist
```