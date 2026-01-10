const { google } = require('googleapis');

// Configuration from environment variables
const CONFIG = {
  content_spreadsheet_id: process.env.CONTENT_SPREADSHEET_ID,
  researchers_spreadsheet_id: process.env.RESEARCHERS_SPREADSHEET_ID,
  credentials: process.env.GOOGLE_CREDENTIALS ? JSON.parse(process.env.GOOGLE_CREDENTIALS) : null
};

// Sheet names mapping
const SHEET_NAMES = {
  news: 'News',
  ideas: 'Ideas',
  reports: 'Reports',
  documents: 'Documents',
  podcasts: 'Podcasts'
};

// Initialize Google Sheets API
async function getSheets() {
  if (!CONFIG.credentials) {
    throw new Error('Google credentials not configured');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: CONFIG.credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  return google.sheets({ version: 'v4', auth });
}

// Get content items from a section
async function getContentItems(section, limit = 10) {
  const sheets = await getSheets();
  const sheetName = SHEET_NAMES[section];

  if (!sheetName) {
    throw new Error(`Invalid section: ${section}`);
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.content_spreadsheet_id,
      range: `${sheetName}!A:G`
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) return []; // Only headers or empty

    // Skip header row and map to objects
    const items = rows.slice(1).map(row => ({
      id: row[0] || '',
      dateAdded: row[1] || '',
      title: row[2] || '',
      url: row[3] || '',
      source: row[4] || '',
      addedBy: row[5] || '',
      status: row[6] || 'active'
    })).filter(item => item.status !== 'deleted' && item.title);

    // Sort by date descending and limit
    items.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));

    return limit ? items.slice(0, limit) : items;
  } catch (error) {
    console.error(`Error fetching ${section}:`, error.message);
    return [];
  }
}

// Get researchers
async function getResearchers(limit = 10) {
  const sheets = await getSheets();

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.researchers_spreadsheet_id,
      range: 'Researchers!A:H'
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) return [];

    const items = rows.slice(1).map(row => ({
      id: row[0] || '',
      name: row[1] || '',
      institution: row[2] || '',
      researchArea: row[3] || '',
      profileUrl: row[4] || '',
      recentPublication: row[5] || '',
      publicationUrl: row[6] || '',
      status: row[7] || 'active'
    })).filter(item => item.status !== 'deleted' && item.name);

    return limit ? items.slice(0, limit) : items;
  } catch (error) {
    console.error('Error fetching researchers:', error.message);
    return [];
  }
}

// Get all content for homepage
async function getAllContent(search = '') {
  const [news, ideas, reports, research, documents, podcasts] = await Promise.all([
    getContentItems('news'),
    getContentItems('ideas'),
    getContentItems('reports'),
    getResearchers(),
    getContentItems('documents'),
    getContentItems('podcasts')
  ]);

  const filterBySearch = (items) => {
    if (!search) return items;
    const searchLower = search.toLowerCase();
    return items.filter(item =>
      (item.title && item.title.toLowerCase().includes(searchLower)) ||
      (item.source && item.source.toLowerCase().includes(searchLower)) ||
      (item.name && item.name.toLowerCase().includes(searchLower)) ||
      (item.institution && item.institution.toLowerCase().includes(searchLower))
    );
  };

  return {
    news: filterBySearch(news),
    ideas: filterBySearch(ideas),
    reports: filterBySearch(reports),
    research: filterBySearch(research),
    documents: filterBySearch(documents),
    podcasts: filterBySearch(podcasts)
  };
}

// Main handler
exports.handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // Parse path
  const path = event.path.replace('/.netlify/functions/api', '').replace('/api', '');
  const segments = path.split('/').filter(Boolean);

  try {
    // GET /api/content - Get all content for homepage
    if (event.httpMethod === 'GET' && (segments[0] === 'content' || segments.length === 0)) {
      if (segments.length === 1 || segments.length === 0) {
        const search = event.queryStringParameters?.search || '';
        const data = await getAllContent(search);
        return { statusCode: 200, headers, body: JSON.stringify(data) };
      }

      // GET /api/content/:section - Get items from specific section
      if (segments.length === 2) {
        const section = segments[1];
        const limit = event.queryStringParameters?.limit
          ? parseInt(event.queryStringParameters.limit)
          : null;

        if (section === 'research') {
          const items = await getResearchers(limit);
          return { statusCode: 200, headers, body: JSON.stringify(items) };
        }

        const items = await getContentItems(section, limit);
        return { statusCode: 200, headers, body: JSON.stringify(items) };
      }
    }

    // GET /api/me - Get current user (placeholder for now)
    if (event.httpMethod === 'GET' && segments[0] === 'me') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ authenticated: false })
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found' })
    };

  } catch (error) {
    console.error('API Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
