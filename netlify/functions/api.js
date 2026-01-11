const { google } = require('googleapis');

// Simple in-memory rate limiting (resets on cold start, but good enough for basic protection)
const rateLimitCache = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 5; // Max 5 submissions per minute per IP

function isRateLimited(ip) {
  const now = Date.now();
  const record = rateLimitCache.get(ip);

  if (!record) {
    rateLimitCache.set(ip, { count: 1, windowStart: now });
    return false;
  }

  // Reset window if expired
  if (now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitCache.set(ip, { count: 1, windowStart: now });
    return false;
  }

  // Increment and check
  record.count++;
  if (record.count > RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  return false;
}

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

// Get pending submissions
async function getSubmissions() {
  const sheets = await getSheets();

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.content_spreadsheet_id,
      range: 'Submissions!A:I'
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) return [];

    const items = rows.slice(1).map(row => ({
      id: row[0] || '',
      dateSubmitted: row[1] || '',
      section: row[2] || '',
      title: row[3] || '',
      url: row[4] || '',
      source: row[5] || '',
      notes: row[6] || '',
      submitterEmail: row[7] || '',
      status: row[8] || 'pending'
    })).filter(item => item.status === 'pending');

    // Sort by date descending
    items.sort((a, b) => new Date(b.dateSubmitted) - new Date(a.dateSubmitted));

    return items;
  } catch (error) {
    console.error('Error fetching submissions:', error.message);
    return [];
  }
}

// Add a submission
async function addSubmission(data) {
  const sheets = await getSheets();

  const id = Date.now().toString();
  const dateSubmitted = new Date().toISOString();
  const row = [
    id,
    dateSubmitted,
    data.section,
    data.title || '',
    data.url,
    data.source || '',
    data.notes || '',
    data.submitterEmail || '',
    'pending',
    data.newsletterSignup ? 'yes' : 'no'
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: CONFIG.content_spreadsheet_id,
    range: 'Submissions!A:J',
    valueInputOption: 'RAW',
    requestBody: {
      values: [row]
    }
  });

  return { id, dateSubmitted, ...data };
}

// Approve a submission (move to content)
async function approveSubmission(id) {
  const sheets = await getSheets();

  // Get the submission
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: CONFIG.content_spreadsheet_id,
    range: 'Submissions!A:I'
  });

  const rows = response.data.values || [];
  const rowIndex = rows.findIndex(row => row[0] === id);

  if (rowIndex === -1) {
    throw new Error('Submission not found');
  }

  const submission = {
    id: rows[rowIndex][0],
    dateSubmitted: rows[rowIndex][1],
    section: rows[rowIndex][2],
    title: rows[rowIndex][3],
    url: rows[rowIndex][4],
    source: rows[rowIndex][5]
  };

  // Add to appropriate section
  if (submission.section === 'research') {
    await addResearcher({
      title: submission.title,
      url: submission.url,
      source: submission.source
    });
  } else {
    await addContentItem(submission.section, {
      title: submission.title,
      url: submission.url,
      source: submission.source
    });
  }

  // Mark submission as approved
  await sheets.spreadsheets.values.update({
    spreadsheetId: CONFIG.content_spreadsheet_id,
    range: `Submissions!I${rowIndex + 1}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [['approved']]
    }
  });

  return { success: true };
}

// Dismiss a submission
async function dismissSubmission(id) {
  const sheets = await getSheets();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: CONFIG.content_spreadsheet_id,
    range: 'Submissions!A:I'
  });

  const rows = response.data.values || [];
  const rowIndex = rows.findIndex(row => row[0] === id);

  if (rowIndex === -1) {
    throw new Error('Submission not found');
  }

  // Mark as dismissed
  await sheets.spreadsheets.values.update({
    spreadsheetId: CONFIG.content_spreadsheet_id,
    range: `Submissions!I${rowIndex + 1}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [['dismissed']]
    }
  });

  return { success: true };
}

// Get all content for homepage
async function getAllContent(search = '', limit = 10) {
  const [news, ideas, reports, research, documents, podcasts] = await Promise.all([
    getContentItems('news', limit),
    getContentItems('ideas', limit),
    getContentItems('reports', limit),
    getResearchers(limit),
    getContentItems('documents', limit),
    getContentItems('podcasts', limit)
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
        const limit = event.queryStringParameters?.limit
          ? parseInt(event.queryStringParameters.limit)
          : 15; // Default to 15 to allow dynamic fitting
        const data = await getAllContent(search, limit);
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

    // GET /api/submissions - Get pending submissions (admin)
    if (event.httpMethod === 'GET' && segments[0] === 'submissions') {
      const items = await getSubmissions();
      return { statusCode: 200, headers, body: JSON.stringify(items) };
    }

    // POST /api/submissions/:id/approve - Approve a submission (admin)
    // Must come before the general POST /api/submissions route
    if (event.httpMethod === 'POST' && segments[0] === 'submissions' && segments[1] && segments[2] === 'approve') {
      const id = segments[1];
      const result = await approveSubmission(id);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // POST /api/submissions/:id/dismiss - Dismiss a submission (admin)
    // Must come before the general POST /api/submissions route
    if (event.httpMethod === 'POST' && segments[0] === 'submissions' && segments[1] && segments[2] === 'dismiss') {
      const id = segments[1];
      const result = await dismissSubmission(id);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // POST /api/submissions - Add a new submission (public)
    if (event.httpMethod === 'POST' && segments[0] === 'submissions') {
      const data = JSON.parse(event.body);

      // Honeypot check - if the hidden field is filled, it's a bot
      if (data.website && data.website.trim() !== '') {
        console.log('Honeypot triggered, rejecting submission');
        // Return success to not tip off the bot, but don't save
        return { statusCode: 201, headers, body: JSON.stringify({ id: 'rejected', success: true }) };
      }

      // Rate limiting check
      const clientIp = event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                       event.headers['client-ip'] ||
                       'unknown';
      if (isRateLimited(clientIp)) {
        return {
          statusCode: 429,
          headers,
          body: JSON.stringify({ error: 'Too many requests. Please try again later.' })
        };
      }

      const result = await addSubmission(data);
      return { statusCode: 201, headers, body: JSON.stringify(result) };
    }

    // GET /api/search - Search across all sections
    if (event.httpMethod === 'GET' && segments[0] === 'search') {
      const q = event.queryStringParameters?.q || '';
      const limit = parseInt(event.queryStringParameters?.limit || '100');
      const sections = event.queryStringParameters?.sections;
      const dateFrom = event.queryStringParameters?.dateFrom;
      const dateTo = event.queryStringParameters?.dateTo;
      const sort = event.queryStringParameters?.sort || 'date';
      const order = event.queryStringParameters?.order || 'desc';

      if (!q || q.trim().length === 0) {
        return { statusCode: 200, headers, body: JSON.stringify({ results: [], total: 0, query: '' }) };
      }

      const searchLower = q.trim().toLowerCase();
      const sectionFilter = sections ? sections.split(',').map(s => s.trim()) : null;

      // Fetch from all sections (no limit, we filter client-side)
      const fetchPromises = [];
      const sectionKeys = [];

      if (!sectionFilter || sectionFilter.includes('news')) {
        fetchPromises.push(getContentItems('news', null));
        sectionKeys.push('news');
      }
      if (!sectionFilter || sectionFilter.includes('ideas')) {
        fetchPromises.push(getContentItems('ideas', null));
        sectionKeys.push('ideas');
      }
      if (!sectionFilter || sectionFilter.includes('reports')) {
        fetchPromises.push(getContentItems('reports', null));
        sectionKeys.push('reports');
      }
      if (!sectionFilter || sectionFilter.includes('documents')) {
        fetchPromises.push(getContentItems('documents', null));
        sectionKeys.push('documents');
      }
      if (!sectionFilter || sectionFilter.includes('podcasts')) {
        fetchPromises.push(getContentItems('podcasts', null));
        sectionKeys.push('podcasts');
      }
      if (!sectionFilter || sectionFilter.includes('research')) {
        fetchPromises.push(getResearchers(null));
        sectionKeys.push('research');
      }

      const fetchResults = await Promise.all(fetchPromises);

      // Combine and filter results
      let results = [];
      fetchResults.forEach((items, index) => {
        const section = sectionKeys[index];
        items.forEach(item => {
          const matchesSearch = (item.title && item.title.toLowerCase().includes(searchLower)) ||
                                (item.source && item.source.toLowerCase().includes(searchLower)) ||
                                (item.authors && item.authors.toLowerCase().includes(searchLower)) ||
                                (item.institutions && item.institutions.toLowerCase().includes(searchLower));
          if (matchesSearch) {
            results.push({ ...item, section });
          }
        });
      });

      // Apply date range filter
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        results = results.filter(item => new Date(item.dateAdded || 0) >= fromDate);
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        results = results.filter(item => new Date(item.dateAdded || 0) <= toDate);
      }

      // Sort results
      if (sort === 'date') {
        results.sort((a, b) => {
          const dateA = new Date(a.dateAdded || 0);
          const dateB = new Date(b.dateAdded || 0);
          return order === 'asc' ? dateA - dateB : dateB - dateA;
        });
      } else if (sort === 'source') {
        results.sort((a, b) => {
          const sourceA = (a.source || '').toLowerCase();
          const sourceB = (b.source || '').toLowerCase();
          return order === 'asc' ? sourceA.localeCompare(sourceB) : sourceB.localeCompare(sourceA);
        });
      } else if (sort === 'title') {
        results.sort((a, b) => {
          const titleA = (a.title || '').toLowerCase();
          const titleB = (b.title || '').toLowerCase();
          return order === 'asc' ? titleA.localeCompare(titleB) : titleB.localeCompare(titleA);
        });
      }

      // Apply limit
      if (limit) {
        results = results.slice(0, limit);
      }

      return { statusCode: 200, headers, body: JSON.stringify({ results, total: results.length, query: q.trim() }) };
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
      body: JSON.stringify({ error: 'Internal server error', message: error.message })
    };
  }
};
