# Use official Node.js LTS (Long Term Support) image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy application source
COPY src/ ./src/

# Expose port (Cloud Run will inject PORT env var)
EXPOSE 3100

# Set Node environment to production
ENV NODE_ENV=production

# Start the application
CMD ["node", "src/index.js"]
