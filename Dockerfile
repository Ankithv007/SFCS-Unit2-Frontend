FROM nginx:alpine

# Install the server configuration containing API routes.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Install the React/Vite frontend.
COPY site/ /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]