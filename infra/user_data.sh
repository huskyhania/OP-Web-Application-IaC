#!/bin/bash
apt-get update -y
apt-get install -y docker.io git
systemctl enable docker
systemctl start docker

cd /opt
git clone https://github.com/huskyhania/OP-Web-Application-IaC web_app
cd web_app/backend

docker build -t backend .
docker run -d -p 4241:4241 \
  -e PORT=4241 \
  -e AWS_REGION=eu-north-1 \
  -e PHOTO_BUCKET=hannas-photo-bucket \
  -e PHOTO_KEY=profile.jpg \
  backend