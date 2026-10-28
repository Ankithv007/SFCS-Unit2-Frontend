FROM nginx:alpine

# Copy the complete Nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy the React frontend build
COPY site/ /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]