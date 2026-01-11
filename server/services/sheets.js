const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Load config
const configPath = path.join(__dirname, '..', '..', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Section name to sheet name mapping
const SECTION_SHEETS = {
  news: 'News',
  ideas: 'Ideas',
  reports: 'Reports',
  documents: 'Documents',
  podcasts: 'Podcasts'
};

let sheetsClient = null;

async function getClient() {
  if (sheetsClient) return sheetsClient;

  const credentialsPath = path.join(__dirname, '..', '..', config.credentials_file);

  if (!fs.existsSync(credentialsPath)) {
    throw new Error(`Credentials file not found: ${credentialsPath}`);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

// Get content items from a section
async function getContentItems(section, options = {}) {
  const sheets = await getClient();
  const sheetName = SECTION_SHEETS[section];

  if (!sheetName) {
    throw new Error(`Invalid section: ${section}`);
  }

  const { limit = 10, offset = 0, search = '', includeTotal = false } = options;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.content_spreadsheet_id,
      range: `${sheetName}!A:G`
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) {
      return includeTotal ? { items: [], total: 0 } : [];
    }

    // Skip header row
    let items = rows.slice(1).map(row => ({
      id: row[0] || '',
      dateAdded: row[1] || '',
      title: row[2] || '',
      url: row[3] || '',
      source: row[4] || '',
      addedBy: row[5] || '',
      status: row[6] || 'active'
    }));

    // Filter out archived items
    items = items.filter(item => item.status !== 'archived');

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      items = items.filter(item =>
        item.title.toLowerCase().includes(searchLower) ||
        item.source.toLowerCase().includes(searchLower)
      );
    }

    // Sort by date (newest first)
    items.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));

    const total = items.length;

    // Apply pagination
    const paginatedItems = items.slice(offset, offset + limit);

    return includeTotal ? { items: paginatedItems, total } : paginatedItems;
  } catch (error) {
    console.error(`Error fetching ${section}:`, error.message);
    return includeTotal ? { items: [], total: 0 } : [];
  }
}

// Add a new content item
async function addContentItem(section, item) {
  const sheets = await getClient();
  const sheetName = SECTION_SHEETS[section];

  if (!sheetName) {
    throw new Error(`Invalid section: ${section}`);
  }

  const id = uuidv4();
  const dateAdded = new Date().toISOString();

  const row = [
    id,
    dateAdded,
    item.title,
    item.url,
    item.source,
    item.addedBy || 'manual',
    'active'
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.content_spreadsheet_id,
    range: `${sheetName}!A:G`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    resource: { values: [row] }
  });

  return { id, dateAdded, ...item, status: 'active' };
}

// Update a content item
async function updateContentItem(section, id, updates) {
  const sheets = await getClient();
  const sheetName = SECTION_SHEETS[section];

  if (!sheetName) {
    throw new Error(`Invalid section: ${section}`);
  }

  // Get all rows to find the item
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.content_spreadsheet_id,
    range: `${sheetName}!A:G`
  });

  const rows = response.data.values || [];
  const rowIndex = rows.findIndex(row => row[0] === id);

  if (rowIndex === -1) {
    throw new Error('Item not found');
  }

  const currentRow = rows[rowIndex];
  const updatedRow = [
    currentRow[0], // id
    currentRow[1], // dateAdded
    updates.title || currentRow[2],
    updates.url || currentRow[3],
    updates.source || currentRow[4],
    currentRow[5], // addedBy
    updates.status || currentRow[6]
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: config.content_spreadsheet_id,
    range: `${sheetName}!A${rowIndex + 1}:G${rowIndex + 1}`,
    valueInputOption: 'RAW',
    resource: { values: [updatedRow] }
  });

  return {
    id: updatedRow[0],
    dateAdded: updatedRow[1],
    title: updatedRow[2],
    url: updatedRow[3],
    source: updatedRow[4],
    addedBy: updatedRow[5],
    status: updatedRow[6]
  };
}

// Delete (archive) a content item
async function deleteContentItem(section, id) {
  return updateContentItem(section, id, { status: 'archived' });
}

// Get researchers
async function getResearchers(options = {}) {
  const sheets = await getClient();
  const { limit = 10, offset = 0, search = '', includeTotal = false } = options;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.researchers_spreadsheet_id,
      range: 'Researchers!A:H'
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) {
      return includeTotal ? { items: [], total: 0 } : [];
    }

    let items = rows.slice(1).map(row => ({
      id: row[0] || '',
      name: row[1] || '',
      institution: row[2] || '',
      researchArea: row[3] || '',
      profileUrl: row[4] || '',
      recentPublication: row[5] || '',
      publicationUrl: row[6] || '',
      status: row[7] || 'active'
    }));

    // Filter out archived
    items = items.filter(item => item.status !== 'archived');

    // Apply search
    if (search) {
      const searchLower = search.toLowerCase();
      items = items.filter(item =>
        item.name.toLowerCase().includes(searchLower) ||
        item.institution.toLowerCase().includes(searchLower) ||
        item.researchArea.toLowerCase().includes(searchLower)
      );
    }

    const total = items.length;
    const paginatedItems = items.slice(offset, offset + limit);

    return includeTotal ? { items: paginatedItems, total } : paginatedItems;
  } catch (error) {
    console.error('Error fetching researchers:', error.message);
    return includeTotal ? { items: [], total: 0 } : [];
  }
}

// Add a researcher
async function addResearcher(researcher) {
  const sheets = await getClient();
  const id = uuidv4();

  const row = [
    id,
    researcher.name,
    researcher.institution,
    researcher.researchArea,
    researcher.profileUrl || '',
    researcher.recentPublication || '',
    researcher.publicationUrl || '',
    'active'
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.researchers_spreadsheet_id,
    range: 'Researchers!A:H',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    resource: { values: [row] }
  });

  return { id, ...researcher, status: 'active' };
}

module.exports = {
  getContentItems,
  addContentItem,
  updateContentItem,
  deleteContentItem,
  getResearchers,
  addResearcher,
  SECTION_SHEETS
};
