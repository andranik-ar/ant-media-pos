# Ant Media POS Dockerfile
FROM ubuntu:22.04

# Set environment variables to avoid interactive prompts
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC
ENV NODE_VERSION=20
ENV PATH="/usr/local/bin:${PATH}"

# Install basic dependencies
RUN apt-get update && apt-get install -y \
    wget \
    curl \
    gnupg \
    software-properties-common \
    unzip \
    systemd \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install systemd for service management
RUN apt-get update && apt-get install -y systemd

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - \
    && apt-get install -y nodejs

# Install Yarn
RUN npm install -g yarn

# Create installation directory
WORKDIR /opt

# Copy the installation script
COPY install.sh /opt/install.sh
RUN chmod +x /opt/install.sh

# Run the Ant Media Server installation
RUN /opt/install.sh

# Copy frontend files
COPY front/ /opt/frontend/
WORKDIR /opt/frontend

# Install frontend dependencies and build
RUN yarn install
RUN yarn build

# Create startup script
RUN echo '#!/bin/bash\n\
set -e\n\
echo "[INFO] Starting Ant Media Server..."\n\
cd /usr/local/antmedia/bin\n\
./start-red5.sh\n\
' > /opt/startup.sh && chmod +x /opt/startup.sh

# Expose required ports
EXPOSE 5080 5443 1935 5554 3000

# Start Ant Media Server and frontend
CMD ["/bin/bash", "-c", "/opt/startup.sh & cd /opt/frontend && yarn start"]