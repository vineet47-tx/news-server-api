# Use an official Node.js image as the base
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to install dependencies
# This is done first to leverage Docker's cache.
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Inform Docker that the container listens on the specified port
EXPOSE 3000

# Define the command to run your app
CMD [ "node", "index.js" ]