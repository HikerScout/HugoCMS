#!/bin/bash
cd ..
for image in podman/hugo-cms-*; do
podman build . -f $image -t $(basename $image)
done
