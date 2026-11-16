# Base image với Bun chính thức trên nền Alpine Linux siêu nhẹ
FROM oven/bun:1.2-alpine

WORKDIR /app

# Copy các thư mục cần thiết để chạy Room Server
COPY package.json ./
COPY packages ./packages
COPY outputs ./outputs
COPY work ./work

# Thiết lập biến môi trường mặc định (Cloud platforms sẽ inject PORT tự động)
ENV TRIPVAULT_HOST=0.0.0.0
ENV PORT=8788
ENV NODE_ENV=production

# Mở cổng 8788
EXPOSE 8788

# Khởi chạy Room Server
CMD ["bun", "outputs/TripVault_Room_Server.mjs"]
