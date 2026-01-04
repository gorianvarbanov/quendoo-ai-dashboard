# Dockerfile for MCP Quendoo Chatbot

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies  
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Expose port
EXPOSE 8000

# Set environment variables
ENV HOST=0.0.0.0
ENV PYTHONUNBUFFERED=1

# Run FastAPI application
CMD python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
