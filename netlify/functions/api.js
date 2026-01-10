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

// Get research items
async function getResearchers(limit = 10) {
  const sheets = await getSheets();

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.researchers_spreadsheet_id,
      range: 'Research!A:H'
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) return [];

    const items = rows.slice(1).map(row => ({
      id: row[0] || '',
      dateAdded: row[1] || '',
      title: row[2] || '',
      url: row[3] || '',
      source: row[4] || '',
      authors: row[5] || '',
      institutions: row[6] || '',
      status: row[7] || 'active'
    })).filter(item => item.status !== 'deleted' && item.title);

    // Sort by date descending
    items.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));

    return limit ? items.slice(0, limit) : items;
  } catch (error) {
    console.error('Error fetching research:', error.message);
    return [];
  }
}

// Add content item
async function addContentItem(section, data) {
  const sheets = await getSheets();
  const sheetName = SHEET_NAMES[section];

  if (!sheetName) {
    throw new Error(`Invalid section: ${section}`);
  }

  const id = Date.now().toString();
  const dateAdded = new Date().toISOString();
  const row = [id, dateAdded, data.title, data.url, data.source || '', 'admin', 'active'];

  await sheets.spreadsheets.values.append({
    spreadsheetId: CONFIG.content_spreadsheet_id,
    range: `${sheetName}!A:G`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [row]
    }
  });

  return { id, dateAdded, ...data };
}

// Update content item
async function updateContentItem(section, id, data) {
  const sheets = await getSheets();
  const sheetName = SHEET_NAMES[section];

  if (!sheetName) {
    throw new Error(`Invalid section: ${section}`);
  }

  // Get all rows to find the one with matching ID
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: CONFIG.content_spreadsheet_id,
    range: `${sheetName}!A:G`
  });

  const rows = response.data.values || [];
  const rowIndex = rows.findIndex(row => row[0] === id);

  if (rowIndex === -1) {
    throw new Error('Item not found');
  }

  // Update the row (keep ID and dateAdded, update title, url, source)
  const existingRow = rows[rowIndex];
  const updatedRow = [
    existingRow[0], // ID
    existingRow[1], // dateAdded
    data.title || existingRow[2],
    data.url || existingRow[3],
    data.source || existingRow[4] || '',
    existingRow[5] || 'admin', // addedBy
    existingRow[6] || 'active' // status
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: CONFIG.content_spreadsheet_id,
    range: `${sheetName}!A${rowIndex + 1}:G${rowIndex + 1}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [updatedRow]
    }
  });

  return { id, ...data };
}

// Delete content item
async function deleteContentItem(section, id) {
  const sheets = await getSheets();
  const sheetName = SHEET_NAMES[section];

  if (!sheetName) {
    throw new Error(`Invalid section: ${section}`);
  }

  // Get all rows to find the one with matching ID
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: CONFIG.content_spreadsheet_id,
    range: `${sheetName}!A:G`
  });

  const rows = response.data.values || [];
  const rowIndex = rows.findIndex(row => row[0] === id);

  if (rowIndex === -1) {
    throw new Error('Item not found');
  }

  // Mark as deleted instead of actually deleting
  await sheets.spreadsheets.values.update({
    spreadsheetId: CONFIG.content_spreadsheet_id,
    range: `${sheetName}!G${rowIndex + 1}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [['deleted']]
    }
  });

  return { success: true };
}

// Add research item
async function addResearcher(data) {
  const sheets = await getSheets();

  const id = Date.now().toString();
  const dateAdded = new Date().toISOString();
  const row = [
    id,
    dateAdded,
    data.title,
    data.url,
    data.source || '',
    data.authors || '',
    data.institutions || '',
    'active'
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: CONFIG.researchers_spreadsheet_id,
    range: 'Research!A:H',
    valueInputOption: 'RAW',
    requestBody: {
      values: [row]
    }
  });

  return { id, dateAdded, ...data };
}

// Update research item
async function updateResearcher(id, data) {
  const sheets = await getSheets();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: CONFIG.researchers_spreadsheet_id,
    range: 'Research!A:H'
  });

  const rows = response.data.values || [];
  const rowIndex = rows.findIndex(row => row[0] === id);

  if (rowIndex === -1) {
    throw new Error('Research item not found');
  }

  const existingRow = rows[rowIndex];
  const updatedRow = [
    existingRow[0], // ID
    existingRow[1], // dateAdded
    data.title || existingRow[2],
    data.url || existingRow[3],
    data.source || existingRow[4] || '',
    data.authors || existingRow[5] || '',
    data.institutions || existingRow[6] || '',
    existingRow[7] || 'active'
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: CONFIG.researchers_spreadsheet_id,
    range: `Research!A${rowIndex + 1}:H${rowIndex + 1}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [updatedRow]
    }
  });

  return { id, ...data };
}

// Delete research item
async function deleteResearcher(id) {
  const sheets = await getSheets();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: CONFIG.researchers_spreadsheet_id,
    range: 'Research!A:H'
  });

  const rows = response.data.values || [];
  const rowIndex = rows.findIndex(row => row[0] === id);

  if (rowIndex === -1) {
    throw new Error('Research item not found');
  }

  // Mark as deleted
  await sheets.spreadsheets.values.update({
    spreadsheetId: CONFIG.researchers_spreadsheet_id,
    range: `Research!H${rowIndex + 1}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [['deleted']]
    }
  });

  return { success: true };
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

    // POST /api/content/:section - Add new item
    if (event.httpMethod === 'POST' && segments[0] === 'content' && segments[1]) {
      const section = segments[1];
      const data = JSON.parse(event.body);

      if (section === 'research') {
        const result = await addResearcher(data);
        return { statusCode: 201, headers, body: JSON.stringify(result) };
      }

      const result = await addContentItem(section, data);
      return { statusCode: 201, headers, body: JSON.stringify(result) };
    }

    // PUT /api/content/:section/:id - Update item
    if (event.httpMethod === 'PUT' && segments[0] === 'content' && segments[1] && segments[2]) {
      const section = segments[1];
      const id = segments[2];
      const data = JSON.parse(event.body);

      if (section === 'research') {
        const result = await updateResearcher(id, data);
        return { statusCode: 200, headers, body: JSON.stringify(result) };
      }

      const result = await updateContentItem(section, id, data);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // DELETE /api/content/:section/:id - Delete item
    if (event.httpMethod === 'DELETE' && segments[0] === 'content' && segments[1] && segments[2]) {
      const section = segments[1];
      const id = segments[2];

      if (section === 'research') {
        const result = await deleteResearcher(id);
        return { statusCode: 200, headers, body: JSON.stringify(result) };
      }

      const result = await deleteContentItem(section, id);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
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
