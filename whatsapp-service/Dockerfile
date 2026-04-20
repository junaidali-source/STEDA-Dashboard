FROM node:20-bookworm-slim

# Install Chromium/Puppeteer dependencies and clean in one layer
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates chromium fonts-liberation libasound2 libatk-bridge2.0-0 \
    libatk1.0-0 libc6 libcups2 libdbus-1-3 libexpat1 libgbm1 libglib2.0-0 \
    libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libx11-6 \
    libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 \
    libxinerama1 libxrandr2 libxrender1 libxtst6 wget xdg-utils \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (production only)
RUN npm install --production

# Copy source code
COPY . .

# Create directory for WhatsApp session persistence
RUN mkdir -p .wwebjs_auth

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "const fs = require('fs'); process.exit(fs.existsSync('/app/wa-status.json') ? 0 : 1)"

# Start the service
CMD ["npm", "start"]
