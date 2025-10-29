//File path: /index.js (root)
// Import required modules
const express = require('express');
const path = require('path');

// AWS SDK v3 S3 client
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');


// Create an Express application
const app = express();

// Define the port for the server to listen on
const port = 3000;

// Set EJS as the view engine
app.set('view engine', 'ejs');

/* 
Set the views directory to 'views'
 in the current directory
 */
app.set('views', path.join(__dirname, 'views'));

/*
 Initialize S3 client.
 It will use DefaultCredentialProvider (ECS task role, env vars, or local profile).
 Optionally set region via AWS_REGION env var or hardcode here.
*/
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });

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

const bucket_name = process.env.BUCKET_NAME || 'my-actual-bucker-name';

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
        throw err;
    }
}

/* 
 Define a route to render the EJS
 template when the root path is accessed
 */
app.get('/', async (req, res) => {
    // Default news items (kept as fallback)
    let newsItems = [
        'How are India-Taliban relations changing? | Explained',
        'What are the new PF withdrawal guidelines? | Explained',
        'What is the latest offering by OpenAI which has caused much outrage? | Explained',
        'How are India-Taliban relations changing? | Explained'
    ];

    let items = newsItems; // fallback

    let keys = [
        'news1.jpg',
        'news2.jpg',
        'news3.jpg',
        'news4.jpg'
    ]

    // Sidebar data (passed to the view)
    const sidebar = {
        latest: [
            'Elections 2025: what to watch',
            'Market roundup: Stocks to watch',
            'Sports: Highlights of the week'
        ],
        categories: [
            { name: 'Technology', slug: 'technology' },
            { name: 'Business', slug: 'business' },
            { name: 'Sports', slug: 'sports' },
            { name: 'World', slug: 'world' }
        ]
    };
    
    try {
            const fetched = await Promise.all(keys.map(k => fetchImageUrlByKey(k)));
            // store fetched objects in items as { key, url }
            items = newsItems.map((x, i) => {
                return {
                    title: x,
                    url: fetched[i]
                }
            })
        console.log('Prepared items for rendering items:', items);
        // Render index.ejs with items (either news strings or fetched s3 objects)
        res.render('index', { name: 'ABC News', items, sidebar });
    } catch (err) {
        console.error('Error while preparing items:', err);
        // on error render page with empty items
        res.render('index', { name: 'ABC News', items: [] });
    }
});
// Start the server and listen on the specified port
app.listen(port, () => {
    // Display a message when the server starts successfully
    console.log(`Server is running at http://localhost:${port}`);
});