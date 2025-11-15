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
- `NEWS_TABLE`: DynamoDB table name for news articles (default: News)
- `SIDEBAR_TABLE`: DynamoDB table name for sidebar data (default: Sidebar)

## Database Schema

### News Table Structure
Each news item in DynamoDB should have:
- `id`: Unique identifier
- `title`: Article title
- `summary`: Brief description
- `author`: Author name
- `publishedAt`: Publication date (ISO string)
- `imageKey`: S3 image key
- `tags`: Array of category tags

### Sidebar Table Structure
Supports two formats:
1. Single config item with `latest[]` and `categories[]` arrays
2. Multiple items with `type` field ("latest" or "category")

### Sample Data
See `data.json` for sample data structure and content.

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

## Development

1. Install dependencies: `npm install`
2. Set environment variables in `.env` file
3. Run locally: `npm start`
4. Access at http://localhost:3000

### Production Considerations
- Ensure AWS credentials have appropriate DynamoDB and S3 permissions
- Configure VPC security groups for ECS deployment
- Set up CloudWatch logging for monitoring

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

## Frontend Technologies

- **Templating**: EJS (Embedded JavaScript)
- **Styling**: Bootstrap 5.3.2, Font Awesome 6.4.0
- **Client-side Features**:
  - Dynamic article modals with navigation
  - Real-time search and category filtering
  - Web Share API with clipboard fallback
  - Bookmark functionality (client-side)
  - Newsletter subscription form (UI only)

## API Endpoints

- `GET /`: Home page with news list and search
- `POST /search`: Handle search form submission
- `GET /article/:id`: View specific article
- `GET /category/:slug`: Category filtering redirect
- `GET /health`: Health check endpoint (returns "OK")




## AWS ECS Deployment

1. **Create ECS Cluster**:
   ```bash
   aws ecs create-cluster --cluster-name news-server-cluster
   ```

2. **Create Task Definition**:
   ```bash
   aws ecs register-task-definition --cli-input-json file://task-definition.json
   ```

3. **Create Service**:
   ```bash
   aws ecs create-service \
     --cluster news-server-cluster \
     --service-name news-server-service \
     --task-definition news-server-api \
     --desired-count 1 \
     --launch-type FARGATE \
     --network-configuration "awsvpcConfiguration={subnets=[subnet-12345],securityGroups=[sg-12345]}"
   ```

4. **Update Service**:
   ```bash
   aws ecs update-service --cluster news-server-cluster --service news-server-service --task-definition news-server-api --desired-count 1
   ```

## OS Architecture
Linux/ARM64

## Health Check
The application includes a health check endpoint at `GET /health` that returns "OK" for container orchestration systems.

Health Check Command: `CMD-SHELL, curl -f http://localhost:3000/health || exit 1`

## Known Limitations
- Bookmark functionality is client-side only
- Article content is currently placeholder text
- No user authentication or session management
