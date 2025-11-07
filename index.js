//File path: /index.js (root)
// Import required modules
const express = require('express');
const path = require('path');

// AWS SDK v3 S3 client
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// AWS SDK v3 DynamoDB client
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { ScanCommand } = require('@aws-sdk/client-dynamodb');


// Create an Express application
const app = express();

// Define the port for the server to listen on
const port = 3000;

// Middleware for parsing form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Set EJS as the view engine
app.set('view engine', 'ejs');

/* 
Set the views directory to 'views'
 in the current directory
 */
app.set('views', path.join(__dirname, 'views'));

 // back-tick - `

 /*
 Initialize S3 client.
 It will use DefaultCredentialProvider (ECS task role, env vars, or local profile).
 Optionally set region via AWS_REGION env var or hardcode here.
*/
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });

/*
 Helper to convert response Body (a stream) to string
*/
async function streamToString(stream) {
    return await new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
}


// Fetch news items from DynamoDB
async function fetchNewsFromDDB() {
    const tableName = process.env.NEWS_TABLE_NAME || 'news-portal-table';
    try {
        const command = new ScanCommand({
            TableName: tableName,
            FilterExpression: 'begins_with(#id, :newsPrefix)',
            ExpressionAttributeNames: {
                '#id': 'id'
            },
            ExpressionAttributeValues: {
                ':newsPrefix': { S: 'news-' }
            }
        });

        const response = await dynamoClient.send(command);
        const items = response.Items || [];

        // Transform DynamoDB items to the expected format
        return items.map(item => ({
            id: item.id.S,
            title: item.title.S,
            summary: item.summary.S,
            author: item.author.S,
            publishedAt: item.publishedAt.S,
            imageKey: item.imageKey.S,
            tags: item.tags.L ? item.tags.L.map(tag => tag.S) : []
        }));
    } catch (err) {
        console.error('Error fetching news from DynamoDB:', err);
        throw err;
    }
}


// Fetch sidebar data from DynamoDB
async function fetchSidebarFromDDB() {
    const tableName = process.env.NEWS_TABLE_NAME || 'news-portal-table';
    try {
        // Fetch latest items
        const latestCommand = new ScanCommand({
            TableName: tableName,
            FilterExpression: '#type = :latestType',
            ExpressionAttributeNames: {
                '#type': 'type'
            },
            ExpressionAttributeValues: {
                ':latestType': { S: 'latest' }
            }
        });

        const latestResponse = await dynamoClient.send(latestCommand);
        const latestItems = latestResponse.Items || [];
        const latest = latestItems.map(item => item.title.S);

        // Fetch categories
        const categoryCommand = new ScanCommand({
            TableName: tableName,
            FilterExpression: '#type = :categoryType',
            ExpressionAttributeNames: {
                '#type': 'type'
            },
            ExpressionAttributeValues: {
                ':categoryType': { S: 'category' }
            }
        });

        const categoryResponse = await dynamoClient.send(categoryCommand);
        const categoryItems = categoryResponse.Items || [];
        const categories = categoryItems.map(item => ({
            name: item.name.S,
            slug: item.slug.S
        }));

        return { latest, categories };
    } catch (err) {
        console.error('Error fetching sidebar from DynamoDB:', err);
        throw err;
    }
}

const bucket_name = process.env.BUCKET_NAME || 'portal-images-cc-assignment';

/*
 Fetch an object from S3 and return its string content.
 Uses env vars BUCKET_NAME and OBJECT_KEY (set in ECS task definition), with optional defaults.
*/
async function fetchImageUrlByKey(key) {
    const Bucket = bucket_name
    const Key = key;

    const cmd = new GetObjectCommand({ Bucket, Key });
    console.log(`Fetching S3 object URL for key=${Key} from bucket=${Bucket}`);

    try {
        // Generate presigned URL (valid for 1 hour)
        const url = await getSignedUrl(s3Client, cmd, { expiresIn: 3600 });
        console.log(`Fetched S3 object URL for key=${url}`);
        return { key: Key, url };
    } catch (err) {
        console.error(`Error fetching S3 object for key=${Key}:`, err);
        console.error('Error code:', err.code);
        console.error('Error message:', err.message);
        console.error('Error stack:', err.stack);
        throw err;
    }
}

/* 
 Define a route to render the EJS
 template when the root path is accessed
 */
app.get('/', async (req, res) => {
    try {
        // Fetch news items and sidebar data
        let newsItems = await fetchNewsFromDDB();
        const sidebar = await fetchSidebarFromDDB();

        // Handle search query
        const searchQuery = req.query.search;
        if (searchQuery && searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            newsItems = newsItems.filter(item =>
                item.title.toLowerCase().includes(query) ||
                item.summary.toLowerCase().includes(query) ||
                item.author.toLowerCase().includes(query) ||
                (item.tags && item.tags.some(tag => tag.toLowerCase().includes(query)))
            );
        }

        // Handle category filter
        const categoryFilter = req.query.category;
        if (categoryFilter && categoryFilter.trim()) {
            const category = categoryFilter.toLowerCase().trim();
            newsItems = newsItems.filter(item =>
                item.tags && item.tags.some(tag => tag.toLowerCase().includes(category))
            );
        }

        console.log('Fetched news items:', newsItems.length);
        console.log('Fetched sidebar data:', sidebar);

        // Render index.ejs with news items and sidebar
        res.render('index', {
            name: 'Amar Ujala',
            items: newsItems,
            sidebar,
            searchQuery: searchQuery || '',
            categoryFilter: categoryFilter || ''
        });
    } catch (err) {
        console.error('Error in route handler:', err);
        // on error render page with empty items
        res.render('index', { name: 'Amar Ujala', items: [], sidebar: { latest: [], categories: [] }, searchQuery: '', categoryFilter: '' });
    }
});

// Handle search form submission
app.post('/search', (req, res) => {
    const searchQuery = req.body.search;
    res.redirect(`/?search=${encodeURIComponent(searchQuery || '')}`);
});

// Handle category filtering - redirect to home with category filter
app.get('/category/:slug', async (req, res) => {
    try {
        const categorySlug = req.params.slug;
        res.redirect(`/?category=${encodeURIComponent(categorySlug)}`);
    } catch (err) {
        console.error('Error in category route:', err);
        res.redirect('/');
    }
});

// Handle article detail (placeholder)
app.get('/article/:id', async (req, res) => {
    try {
        const articleId = req.params.id;
        const newsItems = await fetchNewsFromDDB();
        const article = newsItems.find(item => item.id === articleId);

        if (article) {
            res.render('article', {
                name: 'Amar Ujala',
                article,
                sidebar: await fetchSidebarFromDDB()
            });
        } else {
            res.status(404).render('404', { name: 'Amar Ujala' });
        }
    } catch (err) {
        console.error('Error in article route:', err);
        res.status(500).send('Internal Server Error');
    }
});
// Start the server and listen on the specified port
app.listen(port, () => {
    // Display a message when the server starts successfully
    console.log(`Server is running at http://localhost:${port}`);
});