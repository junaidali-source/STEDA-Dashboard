FROM node:20-bookworm-slim

# Install Chromium dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    libnss3 libxss1 libasound2 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdbus-1-3 libexpat1 libgbm1 libgconf-2-4 libgdk-pixbuf2.0-0 \
    libglib2.0-0 libgtk-3-0 libpango-1.0-0 libpangocairo-1.0-0 \
    libx11-6 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 \
    libxfixes3 libxi6 libxinerama1 libxrandr2 libxrender1 libxtst6 \
    fonts-liberation libappindicator1 libgbm-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Create directory for WhatsApp session (persisted via Railway volume if needed)
RUN mkdir -p .wwebjs_auth

# Start the service
CMD ["npm", "start"]
