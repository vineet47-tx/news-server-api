// File path: /index.js (root)
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
const port = 3000;

// Middleware for parsing form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Initialize AWS clients
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });

/* Helper: Convert stream to string */
async function streamToString(stream) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

/* Helper: Normalize DynamoDB AttributeValue shapes */
function normalizeValue(val) {
  if (val === null || val === undefined) return val;
  if (typeof val !== 'object') return val;
  if ('S' in val) return val.S;
  if ('N' in val) return Number(val.N);
  if ('BOOL' in val) return val.BOOL;
  if ('L' in val) return (val.L || []).map(normalizeValue);
  if ('M' in val) {
    const out = {};
    for (const k of Object.keys(val.M || {})) out[k] = normalizeValue(val.M[k]);
    return out;
  }
  const out = {};
  for (const k of Object.keys(val)) out[k] = normalizeValue(val[k]);
  return out;
}

/*  Fetch news items from DynamoDB */
async function fetchNewsFromDDB() {
  const TableName = process.env.NEWS_TABLE || 'News';
  try {
    const cmd = new ScanCommand({ TableName, Limit: 100 });
    const resp = await dynamoClient.send(cmd);
    const rawItems = resp.Items || [];

    const items = rawItems.map(it => normalizeValue(it));
    const mapped = await Promise.all(items.map(async i => {
      const item = {
        id: i.id || i.ID || null,
        title: i.title || i.heading || i.name || '',
        summary: i.summary || '',
        author: i.author || '',
        publishedAt: i.publishedAt || '',
        imageKey: i.imageKey || i.image || null,
        tags: Array.isArray(i.tags) ? i.tags : (i.tags ? [i.tags] : [])
      };

      if (item.imageKey) {
        try {
          const { url } = await fetchImageUrlByKey(item.imageKey);
          item.imageUrl = url;
        } catch (err) {
          console.error(`Error fetching image URL for key ${item.imageKey}:`, err);
          item.imageUrl = null;
        }
      } else {
        item.imageUrl = null;
      }

      return item;
    }));

    return mapped;
  } catch (err) {
    console.error('Error fetching news from DynamoDB:', err);
    throw err;
  }
}

/* 📚 Fetch sidebar data from DynamoDB */
async function fetchSidebarFromDDB() {
  const TableName = process.env.SIDEBAR_TABLE || 'Sidebar';
  try {
    const cmd = new ScanCommand({ TableName, Limit: 100 });
    const resp = await dynamoClient.send(cmd);
    const rawItems = resp.Items || [];

    const items = rawItems.map(it => normalizeValue(it));

    // Case 1: single config item with latest[] and categories[]
    if (items[0] && (Array.isArray(items[0].latest) || Array.isArray(items[0].categories))) {
      return {
        latest: items[0].latest || [],
        categories: items[0].categories || []
      };
    }

    // Case 2: per-row style
    const latest = items
      .filter(i => i.type === 'latest')
      .map(i => i.title || i.name)
      .filter(Boolean);

    const categories = items
      .filter(i => i.type === 'category')
      .map(i => ({
        name: i.name,
        slug: i.slug || (i.name || '').toLowerCase().replace(/\s+/g, '-')
      }))
      .filter(Boolean);

    return { latest, categories };
  } catch (err) {
    console.error('Error fetching sidebar from DynamoDB:', err);
    throw err;
  }
}

const bucket_name = process.env.BUCKET_NAME || 'portal-images-cc-assignment';

/* Fetch an image’s presigned URL from S3 */
async function fetchImageUrlByKey(key) {
  const Bucket = bucket_name;
  const Key = key;
  const cmd = new GetObjectCommand({ Bucket, Key });

  try {
    const url = await getSignedUrl(s3Client, cmd, { expiresIn: 3600 });
    return { key: Key, url };
  } catch (err) {
    console.error(`Error fetching S3 object for key=${Key}:`, err);
    throw err;
  }
}

/* 🧭 Main route: renders home page */
app.get('/', async (req, res) => {
  try {
    let newsItems = await fetchNewsFromDDB();
    const sidebar = await fetchSidebarFromDDB();

    // Search filter
    const searchQuery = req.query.search;
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      newsItems = newsItems.filter(
        item =>
          item.title.toLowerCase().includes(q) ||
          item.summary.toLowerCase().includes(q) ||
          item.author.toLowerCase().includes(q) ||
          (item.tags && item.tags.some(tag => tag.toLowerCase().includes(q)))
      );
    }

    // Category filter
    const categoryFilter = req.query.category;
    if (categoryFilter && categoryFilter.trim()) {
      const c = categoryFilter.toLowerCase();
      newsItems = newsItems.filter(
        item => item.tags && item.tags.some(tag => tag.toLowerCase().includes(c))
      );
    }

    res.render('index', {
      name: 'Amar Ujala',
      items: newsItems,
      sidebar,
      searchQuery: searchQuery || '',
      categoryFilter: categoryFilter || ''
    });
  } catch (err) {
    console.error('Error in route handler:', err);
    res.render('index', {
      name: 'Amar Ujala',
      items: [],
      sidebar: { latest: [], categories: [] },
      searchQuery: '',
      categoryFilter: ''
    });
  }
});

/* Search form */
app.post('/search', (req, res) => {
  const searchQuery = req.body.search;
  res.redirect(`/?search=${encodeURIComponent(searchQuery || '')}`);
});

/* Category filter redirect */
app.get('/category/:slug', (req, res) => {
  const categorySlug = req.params.slug;
  res.redirect(`/?category=${encodeURIComponent(categorySlug)}`);
});

/* Article detail page */
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

/* Start server */
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});