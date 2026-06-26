#!/bin/bash
rm -rf /home/hugo-cms/final-build
mkdir /home/hugo-cms/final-build
set -e
hugo --minify --destination /home/hugo-cms/final-build
rm -rf /home/hugo-cms/web-public/*
cp -r /home/hugo-cms/final-build/* /home/hugo-cms/web-public/
