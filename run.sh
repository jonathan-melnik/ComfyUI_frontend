#!/bin/bash

# Check if a user ID was provided
if [ -z "$1" ]; then
  echo "Usage: $0 <user-id>"
  exit 1
fi

# Set the environment variable and run the development server
VITE_FLOYO_USER_ID=$1 npm run dev
