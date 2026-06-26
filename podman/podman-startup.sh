#!/bin/bash
echo "See if existing containers need to be shut down"
podman-compose down --timeout 1
echo "Bring services up"
podman-compose up -d

