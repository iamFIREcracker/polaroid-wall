#!/bin/sh
# Runs from /docker-entrypoint.d/ before nginx starts (the nginx:alpine
# entrypoint runs every executable script in there), so the container also
# comes up when nothing is mounted at /storage.

set -e

# nginx serves /images/ straight out of the volume; creating the directory is
# not touching user data, and it keeps the route resolvable on a volume that
# only ever received a config.js.
mkdir -p /storage/images

# Seed the wall only when the volume is fresh.  "Fresh" means no
# /storage/config.js: that file is seeded here and edited by hand afterwards, so
# its presence marks a volume whose content belongs to the user -- which a
# redeploy must never overwrite or sync away.
if [ ! -e /storage/config.js ]; then
    cp /usr/share/nginx/defaults/config.js /storage/config.js
fi
