# News Server API

A Node.js Express application that serves news articles using EJS templates, fetching data from a local JSON file and images from S3.

## Project Structure

```
news-server-api/
├── index.js                 # Main application file with Express server, routes, and AWS integrations
├── package.json             # Dependencies and scripts
├── Dockerfile               # Docker image configuration
├── dynamodb-template.yml    # CloudFormation template for DynamoDB tables
├── data.json                # Sample data for reference
├── views/                   # EJS templates
│   ├── index.ejs           # Home page with news list
│   ├── article.ejs         # Individual article page
│   └── header.ejs          # Header component
├── .dockerignore           # Docker ignore file
├── .gitignore              # Git ignore file
└── README.md               # This file
```

## Prerequisites

- Node.js (v20 or higher)
- AWS CLI configured with appropriate permissions
- Docker (for containerization)

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd news-server-api
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Environment Variables

Set the following environment variables:

- `AWS_REGION`: AWS region (default: ap-south-1)
- `BUCKET_NAME`: S3 bucket name for images (default: portal-images-cc-assignment)

## Running Locally

1. Ensure AWS credentials are configured (via AWS CLI or environment variables).

2. Start the server:
   ```bash
   npm start
   ```

3. Open http://localhost:3000 in your browser.

## Docker

### Build the Image
```bash
docker build -t news-server-api .
```

### Run the Container
```bash
docker run -p 8080:3000 -d --name my-express-container news-server-api
```

To stop and remove:
```bash
docker stop my-express-container
docker rm my-express-container
```

## AWS ECR Deployment

1. Configure AWS CLI with full admin access (if new to IAM).

2. Authenticate Docker with ECR:
   ```bash
   aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin 901741122726.dkr.ecr.ap-south-1.amazonaws.com
   ```

3. Build the Docker image:
   ```bash
   docker build -t news-server-api .
   ```

4. Tag the image:
   ```bash
   docker tag news-server-api:latest 901741122726.dkr.ecr.ap-south-1.amazonaws.com/news-server-api:latest
   ```

5. Push to ECR:
   ```bash
   docker push 901741122726.dkr.ecr.ap-south-1.amazonaws.com/news-server-api:latest
   ```

6. Verify:
   ```bash
   aws ecr list-images --repository-name news-server-api
   ```

## Features

- **News Listing**: Displays news articles from DynamoDB with images
- **Search**: Filter articles by title, summary, author, or tags
- **Article Details**: View individual articles with images
- **Sidebar**: Shows latest news and categories
- **Image Serving**: Generates presigned URLs for S3 images and displays them in the UI

## API Endpoints

- `GET /`: Home page with news list and search
- `POST /search`: Handle search form submission
- `GET /article/:id`: View specific article




## Container

- create cluster
- create task
- run task in cluster