#!/bin/sh
set -eu
for p in /app/pocketbay.properties /workspace/pocketbay.properties /pocketbay.properties; do
  if [ -f "$p" ] && [ -r "$p" ]; then
    umask 077
    cp "$p" /tmp/pocketbay.properties
    chown museum:museum /tmp/pocketbay.properties
    export SPRING_CONFIG_IMPORT=optional:file:/tmp/pocketbay.properties
    echo "[entrypoint] loaded PocketBay configuration" >&2
    break
  fi
done
chown -R museum:museum /data
exec setpriv --reuid=museum --regid=museum --init-groups java -jar /app/app.jar
