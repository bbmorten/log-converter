# Log & Cast File Viewer - Next.js Application

## Overview

A Next.js application that reads log files and asciinema cast files from a `logging` directory, converts them to structured formats, and displays them in an interactive interface with file selection, filtering, and search capabilities.

**Deployment Options:**
- 🖥️ **Local Development**: Run directly with Node.js for development and testing
- 🐳 **Docker**: Containerized deployment with multi-stage optimized build
- ☸️ **Kubernetes**: Production-ready deployment with persistent storage, health checks, and helper scripts

## Features

- **File Selection Interface**: Browse and select multiple files from the logging directory
- **Multi-Format Support**:
  - **Log Files (.log)**: Standard application logs, access logs, unstructured logs
  - **Cast Files (.cast)**: Asciinema terminal session recordings
- **Interactive Log Display**: Clean, responsive table UI with:
  - Color-coded log levels (ERROR, WARNING, INFO, DEBUG, ACCESS)
  - Search functionality across messages and filenames
  - Filter by log level
  - Real-time refresh capability
- **Asciinema Player Integration**: Built-in terminal session playback with:
  - Play/pause controls
  - Speed adjustment
  - Responsive terminal rendering
  - Base64 data URL support (fixes WebKit blob resource errors)
- **Markdown Conversion**: Convert cast files to markdown format with:
  - Recording metadata (dimensions, timestamp, environment)
  - Full terminal output in code blocks
  - Event timeline table
  - One-click copy to clipboard
  - Optional markdown preview
- **Built with Modern Stack**:
  - Next.js 15.5.3 with App Router and Turbopack
  - React 19.1.0
  - TypeScript 5 for type safety
  - Tailwind CSS 4 for styling
  - Asciinema Player 3.10.0 for terminal recordings

## Project Structure

```text
log-converter/
├── app/
│   ├── api/
│   │   ├── files/
│   │   │   └── route.ts          # API endpoint for file discovery
│   │   ├── logs/
│   │   │   └── route.ts          # API endpoint for reading log files
│   │   ├── cast/
│   │   │   └── route.ts          # API endpoint for reading cast files
│   │   └── cast-to-markdown/
│   │       └── route.ts          # API endpoint for converting cast to markdown
│   ├── components/
│   │   ├── AsciinemaPlayer.tsx   # Asciinema player component
│   │   └── MarkdownViewer.tsx    # Markdown viewer with copy functionality
│   ├── page.tsx                  # Main page with log viewer table
│   ├── layout.tsx                # Root layout
│   └── globals.css               # Global styles
├── k8s/                          # Kubernetes deployment manifests
│   ├── namespace.yaml            # Namespace configuration
│   ├── pvc.yaml                  # PersistentVolumeClaim for storage
│   ├── init-job.yaml             # Job to initialize sample log files
│   ├── deployment.yaml           # Application deployment
│   ├── service.yaml              # NodePort service
│   └── README.md                 # Kubernetes deployment guide
├── logging/                      # Directory containing log and cast files
│   ├── app.log                   # Sample application log
│   ├── system.log                # Sample system log
│   ├── access.log                # Sample access log
│   ├── session1.log              # Sample session log
│   ├── demo.cast                 # Sample asciinema recording
│   └── cilium-installation-v1.cast  # Cilium installation recording
├── public/                       # Static assets
├── Dockerfile                    # Multi-stage Docker build configuration
├── .dockerignore                 # Docker build exclusions
├── copy-to-pod.sh                # Helper script to copy files to Kubernetes pod
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript configuration (ES2018 target)
├── CLAUDE.md                     # This documentation file
├── DEPLOYMENT.md                 # Kubernetes deployment and operations guide
├── QUICK-START.md                # Quick reference guide
└── README.md                     # Standard Next.js README
```

## Getting Started

### Prerequisites

**For Local Development:**
- Node.js 18+ and npm installed
- Log files placed in the `logging/` directory

**For Kubernetes Deployment:**
- Kubernetes cluster (e.g., KinD, minikube, or production cluster)
- kubectl configured and connected to your cluster
- Docker installed for building images

### Installation & Running

#### Local Development

```bash
# Install dependencies
npm install

# Run development server (with Turbopack)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

The application will be available at `http://localhost:3000`

#### Kubernetes Deployment

**Quick Start:**

```bash
# 1. Build and load Docker image
docker build -t log-converter:latest .
kind load docker-image log-converter:latest --name cilium-labs

# 2. Deploy to Kubernetes
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/pvc.yaml
kubectl apply -f k8s/init-job.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml

# 3. Wait for deployment to be ready
kubectl wait --for=condition=Ready pod -l app=log-converter -n log-converter --timeout=120s

# 4. Copy your log files to the pod
./copy-to-pod.sh ./logging/

# 5. Access the application
kubectl port-forward -n log-converter svc/log-converter 3000:3000
```

Then open `http://localhost:3000` in your browser.

**For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md) or [QUICK-START.md](QUICK-START.md)**

## How It Works

### 1. File Discovery ([app/api/files/route.ts](app/api/files/route.ts))

- Scans the `logging/` directory for all files
- Identifies file types by extension (.log, .cast, other)
- Returns file metadata including size, modification date, and type
- Enables selective file processing

### 2. Log File Processing ([app/api/logs/route.ts](app/api/logs/route.ts))

- Accepts POST requests with selected log files
- Parses each line based on detected format:
  - **Standard logs**: `YYYY-MM-DD HH:MM:SS LEVEL Message`
  - **Access logs**: `IP - - [timestamp] "request" status size`
  - **Fallback**: Treats entire line as message with UNKNOWN level
- Returns structured JSON with parsed log entries

### 3. Cast File Processing ([app/api/cast/route.ts](app/api/cast/route.ts))

- Accepts POST requests with selected cast files
- Reads asciinema cast files in JSON format
- Returns raw cast content for player rendering

### 4. Cast to Markdown Conversion ([app/api/cast-to-markdown/route.ts](app/api/cast-to-markdown/route.ts))

- Accepts POST requests with selected cast files
- Parses cast file header and events
- Generates formatted markdown including:
  - Recording metadata (version, dimensions, timestamp, environment)
  - Full terminal output in code blocks
  - Event timeline table with time slots
- Returns markdown text ready for copying

### 5. Frontend Display ([app/page.tsx](app/page.tsx))

- **File Selection Mode**: Browse and select files with visual indicators
- **Log View Mode**: Interactive table with search, filtering, and sorting
- **Cast View Mode**: Embedded asciinema players for terminal recordings
- **Markdown View Mode**: Converted markdown with copy and preview functionality
- Dynamic navigation between different view modes

### 6. Asciinema Player Component ([app/components/AsciinemaPlayer.tsx](app/components/AsciinemaPlayer.tsx))

- Dynamically loads asciinema-player library via CDN (v3.7.1)
- Renders terminal recordings with full playback controls
- **WebKit Compatibility Fix**: Uses base64 data URLs instead of blob URLs to avoid WebKit resource errors
- **Fallback Mechanism**: If primary rendering fails, attempts alternative parsing approach
- Handles both structured and raw cast file formats
- Responsive design with proper error handling and user-friendly error messages
- Automatic cleanup and disposal of player instances

### 7. Markdown Viewer Component ([app/components/MarkdownViewer.tsx](app/components/MarkdownViewer.tsx))

- Displays converted markdown in a code-friendly format
- **Copy to Clipboard**: One-click copy functionality with visual feedback
- **Preview Toggle**: Switch between raw markdown and rendered preview
- Simple markdown-to-HTML renderer for preview mode
- Shows line and character count
- Dark theme for raw markdown display

### 8. Adding New Files

#### Local Development

Simply place any `.log` or `.cast` file in the `logging/` directory:

- **Log files** (.log): Will be parsed and displayed in the table
- **Cast files** (.cast): Will be rendered as playable terminal recordings or converted to markdown
- Files appear immediately in the file selection interface

#### Kubernetes Deployment

Use the provided helper script to copy files to the pod:

```bash
# Copy entire logging directory
./copy-to-pod.sh

# Copy specific file
./copy-to-pod.sh ./logging/yourfile.log

# Copy specific cast file
./copy-to-pod.sh ./logging/recording.cast
```

The script will:
- Automatically locate the running pod
- Copy the files to the persistent storage
- Verify the copy was successful
- Show the files in the pod
- Test the API endpoint

**Manual copy:**

```bash
# Get pod name
POD_NAME=$(kubectl get pod -n log-converter -l app=log-converter -o jsonpath='{.items[0].metadata.name}')

# Copy file
kubectl cp ./logging/yourfile.log log-converter/$POD_NAME:/app/logging/ -n log-converter
```

**Files persist across pod restarts** thanks to the PersistentVolumeClaim.

## Log Level Color Coding

- **ERROR**: Red background (critical issues)
- **WARNING/WARN**: Yellow background (potential issues)
- **INFO**: Blue background (informational messages)
- **DEBUG**: Gray background (debug information)
- **ACCESS**: Green background (access logs)
- **UNKNOWN**: Gray background (unparsed logs)

## API Endpoints

### GET /api/files

Returns metadata for all files in the `logging/` directory.

**Response Format:**

```json
{
  "files": [
    {
      "name": "app.log",
      "size": 1234,
      "modified": "2024-01-15T10:00:00.000Z",
      "type": "log",
      "extension": ".log"
    },
    {
      "name": "session.cast",
      "size": 5678,
      "modified": "2024-01-15T11:00:00.000Z",
      "type": "cast",
      "extension": ".cast"
    }
  ],
  "count": 2
}
```

### POST /api/logs

Processes selected log files and returns parsed entries.

**Request Format:**

```json
{
  "files": ["app.log", "system.log"]
}
```

**Response Format:**

```json
{
  "logs": [
    {
      "id": "filename-lineNumber",
      "fileName": "app.log",
      "timestamp": "2024-01-15 10:23:45",
      "level": "INFO",
      "message": "Application started successfully",
      "raw": "original log line"
    }
  ],
  "count": 30
}
```

### POST /api/cast

Processes selected cast files and returns their content.

**Request Format:**

```json
{
  "files": ["session.cast"]
}
```

**Response Format:**

```json
{
  "casts": [
    {
      "fileName": "session.cast",
      "content": "{\"version\": 2, \"width\": 80, \"height\": 24, ...}"
    }
  ],
  "count": 1
}
```

### POST /api/cast-to-markdown

Converts selected cast files to markdown format.

**Request Format:**

```json
{
  "files": ["session.cast"]
}
```

**Response Format:**

```json
{
  "markdowns": [
    {
      "fileName": "session.cast",
      "markdown": "# Terminal Recording: session.cast\n\n## Recording Information\n..."
    }
  ],
  "count": 1
}
```

## Technical Details

### Asciinema Player Implementation

The asciinema player implementation includes several key technical decisions:

1. **Data URL Approach**: Uses base64-encoded data URLs instead of blob URLs to avoid WebKit security restrictions
2. **Dynamic Loading**: Loads the player library from CDN to reduce bundle size
3. **Error Handling**: Implements fallback parsing when primary rendering fails
4. **Memory Management**: Properly disposes player instances to prevent memory leaks

### Build Configuration

- **Turbopack**: Enabled for dev builds, standard build for production (Docker compatibility)
- **ESLint**: Configured with Next.js recommended settings
- **TypeScript**: Strict type checking enabled, ES2018 target for regex compatibility
- **Standalone Output**: Optimized for Docker deployment with minimal dependencies

### Docker & Kubernetes

The application includes production-ready containerization and orchestration:

#### Docker Configuration

**Multi-stage build** ([Dockerfile](Dockerfile)):
- **Stage 1 (deps)**: Install dependencies with npm ci
- **Stage 2 (builder)**: Build the Next.js application with standalone output
- **Stage 3 (runner)**: Minimal runtime image with only necessary files
- **Base Image**: node:20-alpine for small footprint
- **Security**: Runs as non-root user (nextjs:1001)
- **Size**: Optimized with .dockerignore and standalone output

**Build command:**
```bash
docker build -t log-converter:latest .
```

#### Kubernetes Deployment

**Architecture:**
- **Namespace**: Isolated `log-converter` namespace
- **Deployment**: Single replica with resource limits (256Mi-512Mi memory)
- **Service**: NodePort (30300) for external access
- **Storage**: 5Gi PersistentVolumeClaim with local-path provisioner
- **Init Job**: Automatically creates sample log files on first deployment
- **Health Checks**: Liveness and readiness probes for reliability

**Features:**
- ✅ Persistent storage for log files (survives pod restarts)
- ✅ Automatic initialization with sample data
- ✅ Resource limits for cluster stability
- ✅ Health monitoring with HTTP probes
- ✅ Compatible with KinD, minikube, and production clusters

**Helper Script** ([copy-to-pod.sh](copy-to-pod.sh)):
- Automated file copying to running pods
- Validates pod status before copying
- Verifies successful transfer
- Tests API endpoints
- Color-coded output for clarity

**Quick deployment:**
```bash
docker build -t log-converter:latest .
kind load docker-image log-converter:latest --name cilium-labs
kubectl apply -f k8s/
kubectl wait --for=condition=Ready pod -l app=log-converter -n log-converter
./copy-to-pod.sh ./logging/
kubectl port-forward -n log-converter svc/log-converter 3000:3000
```

**Documentation:**
- [DEPLOYMENT.md](DEPLOYMENT.md) - Complete deployment and operations guide
- [QUICK-START.md](QUICK-START.md) - Quick reference for common tasks
- [k8s/README.md](k8s/README.md) - Kubernetes manifest documentation

## Customization

### Adding New Log Formats

To support additional log formats, modify the `parseLogLine` function in [app/api/logs/route.ts](app/api/logs/route.ts):

```typescript
// Add a new regex pattern for your format
const myFormatPattern = /your-regex-here/;
const match = line.match(myFormatPattern);
if (match) {
  return {
    // Extract and return log entry
  };
}
```

### Modifying Table Columns

Edit the table structure in [app/page.tsx](app/page.tsx) to add/remove columns or change display format.

### Changing Color Scheme

Modify the `getLevelColor` function in [app/page.tsx](app/page.tsx) to customize log level colors.

### Player Configuration

Adjust player options in [app/components/AsciinemaPlayer.tsx](app/components/AsciinemaPlayer.tsx):

- `autoPlay`: Start playback automatically
- `loop`: Loop the recording
- `speed`: Playback speed multiplier
- `theme`: Color theme (asciinema, tango, solarized-dark, solarized-light, monokai)
- `idleTimeLimit`: Skip long idle periods
- `fit`: Sizing behavior (width, height, both, none)

## Performance Considerations

- Logs are parsed on each API request (no caching)
- Large log files may impact performance
- Cast files are loaded entirely into memory
- Consider implementing:
  - Pagination for large datasets
  - Server-side caching with Redis or in-memory store
  - Streaming for real-time logs
  - Background processing for very large files
  - Lazy loading for cast file playback

## Known Issues & Fixes

### WebKit Blob Resource Error (FIXED)

**Issue**: Safari and WebKit-based browsers previously showed "Not allowed to load local resource" errors when loading cast files via blob URLs.

**Solution**: Implemented base64 data URL approach in [app/components/AsciinemaPlayer.tsx:72-73](app/components/AsciinemaPlayer.tsx#L72-L73), converting cast content to data URLs which are compatible with all browsers.

## Future Enhancements

- Real-time log streaming with WebSocket
- Export functionality (CSV, JSON, filtered results)
- Advanced filtering (date range, regex patterns, custom queries)
- Log file upload interface (drag & drop)
- Persistent filter preferences (localStorage)
- Log aggregation and statistics dashboard
- Multi-file comparison view
- Syntax highlighting for structured logs (JSON, XML)
- Download recordings as video files
- Share recordings via permalinks

## Troubleshooting

### Local Development

#### No logs appearing

- Ensure `.log` files exist in the `logging/` directory
- Check file permissions (must be readable by Node.js process)
- Verify log file format matches supported patterns
- Check browser console for API errors

#### Parsing issues

- Check log format against supported patterns in [app/api/logs/route.ts](app/api/logs/route.ts)
- Review browser console for API errors
- Ensure timestamps are in expected format (YYYY-MM-DD HH:MM:SS)
- Verify file encoding is UTF-8

#### Cast file playback issues

- Ensure cast files are valid asciinema v2 format
- Check browser console for player errors
- Verify file is not corrupted (should be newline-delimited JSON)
- Try opening cast file in text editor to verify format

#### Performance issues

- Reduce log file size or split into multiple files
- Use browser with better performance (Chrome recommended)
- Close other tabs to free up memory
- Consider implementing pagination (not yet implemented)
- Use server-side filtering for large datasets

#### Build errors

- Ensure Node.js 18+ is installed: `node --version`
- Clear `.next` directory: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check for TypeScript errors: `npx tsc --noEmit`

### Kubernetes Deployment

#### Pod not starting

```bash
# Check pod status
kubectl get pods -n log-converter
kubectl describe pod -n log-converter -l app=log-converter
kubectl logs -n log-converter deployment/log-converter
```

#### Files not appearing in UI

```bash
# Verify files are in the pod
kubectl exec -n log-converter deployment/log-converter -- ls -lah /app/logging

# Test API endpoint
kubectl exec -n log-converter deployment/log-converter -- wget -O- http://localhost:3000/api/files
```

#### Cannot copy files to pod

```bash
# Use the helper script
./copy-to-pod.sh ./logging/yourfile.log

# Or check pod status
kubectl get pod -n log-converter -l app=log-converter
```

#### Application not accessible

```bash
# Ensure port-forward is running
kubectl port-forward -n log-converter svc/log-converter 3000:3000

# Or check service
kubectl get svc -n log-converter
kubectl get endpoints -n log-converter
```

**For detailed Kubernetes troubleshooting, see [DEPLOYMENT.md](DEPLOYMENT.md#troubleshooting)**

## Contributing

When contributing to this project:

1. Update this documentation file when adding features
2. Follow the existing code style (TypeScript, functional components)
3. Add error handling for new API endpoints
4. Test with both small and large files
5. Verify compatibility with Safari, Chrome, and Firefox
6. Update the project structure section if adding new files

## License

This project is for educational and demonstration purposes.
