# Build the wall, then serve it as static files on port 80.

FROM node:20-alpine AS build

WORKDIR /app

# react-textfit declares a peer dependency on React 0.14, which npm refuses to
# reconcile on its own.
COPY package.json ./
RUN npm install --legacy-peer-deps

COPY . ./

# The real public/config.js is a symlink into Dropbox and is kept out of the
# build context (see .dockerignore), but public/index.html loads it and
# src/App.js reads the CONFIG global it declares -- so stub it out.  The image
# deliberately ships no content: the actual config and pictures are meant to be
# served from the ONCE persistent volume at runtime.
RUN echo "const CONFIG = { title: 'polaroid-wall', theme: 'White', images: [] };" > public/config.js

# webpack 3 hashes with md4, which modern OpenSSL no longer offers.
RUN NODE_OPTIONS=--openssl-legacy-provider npm run build


FROM nginx:alpine

LABEL maintainer="Matteo Landi"

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

# /config.js and /images/ are served from /storage (see nginx.conf), so the stub
# built into build/ is kept aside as the seed for a fresh volume rather than
# left under html/ as a second, never-served copy.
RUN mkdir -p /usr/share/nginx/defaults \
    && mv /usr/share/nginx/html/config.js /usr/share/nginx/defaults/config.js

COPY seed-storage.sh /docker-entrypoint.d/40-seed-storage.sh
RUN chmod +x /docker-entrypoint.d/40-seed-storage.sh

EXPOSE 80
