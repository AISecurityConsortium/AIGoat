FROM node:18-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --silent

COPY . .
# Empty on purpose. The browser then calls the same host that opened the page
# (localhost or the host VLAN IP). Nginx proxies /api and /media to the backend.
# Do not set this to http://localhost:8000 — other machines would call themselves.
ENV REACT_APP_API_URL=
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
