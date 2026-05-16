FROM node:20-alpine

WORKDIR /app

# Copy the entire project
COPY . .

# Install dependencies and build the frontend
# (This utilizes the existing "build" script in your root package.json)
RUN npm install
RUN npm run build

# Expose the port (Cloud Run automatically sets the PORT environment variable to 8080)
EXPOSE 8080

# Start the backend server
CMD ["npm", "start"]
