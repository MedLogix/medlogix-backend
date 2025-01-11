#!/bin/bash

# Set variables
TAGNAME=latest
IMAGE_NAME="ayush1018/medlogix-backend:$TAGNAME"

# Build the Docker image
echo "Building Docker image: $IMAGE_NAME..."
docker build --platform linux/amd64 -t $IMAGE_NAME .

# Check if the build was successful
if [ $? -ne 0 ]; then
  echo "Error: Docker build failed."
  exit 1
fi

# Push the Docker image to Docker Hub
echo "Pushing Docker image to Docker Hub..."
docker push $IMAGE_NAME

# Check if the push was successful
if [ $? -ne 0 ]; then
  echo "Error: Docker push failed."
  exit 1
fi

echo "Docker image pushed successfully: $IMAGE_NAME"