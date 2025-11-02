//File path: /index.js (root)
// Import required modules
const express = require('express');
const path = require('path');

// AWS SDK v3 S3 client
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');


const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

// Initialize DynamoDB Document client (uses same region/env chain)
const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(ddbClient);


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

 // back-tick - `

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

function normalizeValue(val) {
    if (val === null || val === undefined) return val;
    if (typeof val !== 'object') return val;

    // DynamoDB low-level attribute value shapes
    if ('S' in val) return val.S;
    if ('N' in val) return Number(val.N);
    if ('BOOL' in val) return val.BOOL;
    if ('L' in val) return (val.L || []).map(normalizeValue);
    if ('M' in val) {
        const out = {};
        for (const k of Object.keys(val.M || {})) out[k] = normalizeValue(val.M[k]);
        return out;
    }

    // If already a plain object (DocumentClient), normalize its fields
    const out = {};
    for (const k of Object.keys(val)) out[k] = normalizeValue(val[k]);
    return out;
}

// new: fetch news items from DynamoDB (expects items with a `title` or `heading` attribute)
async function fetchNewsFromDDB() {
    const TableName = process.env.NEWS_TABLE || 'News';
    try {
        const cmd = new ScanCommand({ TableName, Limit: 100 });
        const resp = await docClient.send(cmd);
        const rawItems = resp.Items || [];

        // normalize low-level AttributeValue shapes or DocumentClient shapes
        const items = rawItems.map(it => normalizeValue(it));

        // map to a consistent shape the app expects
        const mapped = items.map(i => ({
            id: i.id || i.ID || null,
            title: i.title || i.heading || i.name || '',
            summary: i.summary || '',
            author: i.author || '',
            publishedAt: i.publishedAt || '',
            imageKey: i.imageKey || i.image || null,
            tags: Array.isArray(i.tags) ? i.tags : (i.tags ? [i.tags] : [])
        }));

        return mapped;
    } catch (err) {
        console.error('Error fetching news from DynamoDB:', err);
        throw err;
    }
}


// new: fetch sidebar data from DynamoDB
// supports two schemas:
// 1) each item has type: 'latest' or 'category' with appropriate fields
// 2) single config item with latest[] and categories[] attributes
async function fetchSidebarFromDDB() {
    const TableName = process.env.SIDEBAR_TABLE || 'Sidebar';
    try {
        const cmd = new ScanCommand({ TableName, Limit: 100 });
        const resp = await docClient.send(cmd);
        const rawItems = resp.Items || [];

        // normalize all items to plain JS objects
        const items = rawItems.map(it => normalizeValue(it));

        // support single-config item with arrays: { latest: [...], categories: [...] }
        if (items[0] && (Array.isArray(items[0].latest) || Array.isArray(items[0].categories))) {
            return {
                latest: items[0].latest || [],
                categories: items[0].categories || []
            };
        }

        // per-row style: type === 'latest' or type === 'category'
        const latest = items
            .filter(i => (i.type === 'latest'))
            .map(i => i.title || i.name)
            .filter(Boolean);

        const categories = items
            .filter(i => (i.type === 'category'))
            .map(i => ({ name: i.name, slug: i.slug || (i.name || '').toLowerCase().replace(/\s+/g, '-') }))
            .filter(Boolean);

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
        throw err;
    }
}

/* 
 Define a route to render the EJS
 template when the root path is accessed
 */
app.get('/', async (req, res) => {
    // Default news items (kept as fallback)
    let newsItems = await fetchNewsFromDDB();

    let items = newsItems; // fallback

    let keys = [
        'news1.jpg',
        'news2.jpg',
        'news3.jpg',
        'news4.jpg'
    ]

    sidebar = await fetchSidebarFromDDB();
    console.log('Fetched sidebar data:', sidebar);
    
    try {
            const fetched = await Promise.all(keys.map(k => fetchImageUrlByKey(k)));
            // store fetched objects in items as { key, url }
            items = newsItems.map((x, i) => {
                return {
                    title: x.title,
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