const express = require('express');
const router = express.Router();
const sheets = require('../services/sheets');
const { isAdmin } = require('../middleware/auth');

// Get all content for homepage (all sections)
router.get('/content', async (req, res) => {
  try {
    const { search, limit = 10 } = req.query;
    const options = { limit: parseInt(limit), search };

    const [news, ideas, reports, documents, podcasts, researchers] = await Promise.all([
      sheets.getContentItems('news', options),
      sheets.getContentItems('ideas', options),
      sheets.getContentItems('reports', options),
      sheets.getContentItems('documents', options),
      sheets.getContentItems('podcasts', options),
      sheets.getResearchers(options)
    ]);

    res.json({
      news,
      ideas,
      reports,
      research: researchers,
      documents,
      podcasts
    });
  } catch (error) {
    console.error('Error fetching content:', error);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

// Search across all sections
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 100, sections, dateFrom, dateTo, sort = 'date', order = 'desc' } = req.query;

    if (!q || q.trim().length === 0) {
      return res.json({ results: [], total: 0, query: '' });
    }

    // Parse sections filter (comma-separated)
    const sectionFilter = sections ? sections.split(',').map(s => s.trim()) : null;

    const searchOptions = { search: q.trim(), limit: parseInt(limit) };

    // Fetch from all sections or filtered sections
    const fetchPromises = [];
    const sectionKeys = [];

    if (!sectionFilter || sectionFilter.includes('news')) {
      fetchPromises.push(sheets.getContentItems('news', searchOptions));
      sectionKeys.push('news');
    }
    if (!sectionFilter || sectionFilter.includes('ideas')) {
      fetchPromises.push(sheets.getContentItems('ideas', searchOptions));
      sectionKeys.push('ideas');
    }
    if (!sectionFilter || sectionFilter.includes('reports')) {
      fetchPromises.push(sheets.getContentItems('reports', searchOptions));
      sectionKeys.push('reports');
    }
    if (!sectionFilter || sectionFilter.includes('documents')) {
      fetchPromises.push(sheets.getContentItems('documents', searchOptions));
      sectionKeys.push('documents');
    }
    if (!sectionFilter || sectionFilter.includes('podcasts')) {
      fetchPromises.push(sheets.getContentItems('podcasts', searchOptions));
      sectionKeys.push('podcasts');
    }
    if (!sectionFilter || sectionFilter.includes('research')) {
      fetchPromises.push(sheets.getResearchers(searchOptions));
      sectionKeys.push('research');
    }

    const fetchResults = await Promise.all(fetchPromises);

    // Combine and tag results with their section
    let results = [];
    fetchResults.forEach((items, index) => {
      const section = sectionKeys[index];
      if (section === 'research') {
        results.push(...items.map(item => ({
          ...item,
          section: 'research',
          title: item.name,
          source: item.institution
        })));
      } else {
        results.push(...items.map(item => ({ ...item, section })));
      }
    });

    // Apply date range filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      results = results.filter(item => new Date(item.dateAdded || 0) >= fromDate);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999); // Include the entire end day
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

    res.json({
      results,
      total: results.length,
      query: q.trim()
    });
  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({ error: 'Failed to search content' });
  }
});

// Get content for a specific section
router.get('/content/:section', async (req, res) => {
  try {
    const { section } = req.params;
    const { search, limit = 50, offset = 0 } = req.query;

    if (section === 'research') {
      const result = await sheets.getResearchers({
        limit: parseInt(limit),
        offset: parseInt(offset),
        search,
        includeTotal: true
      });
      return res.json(result);
    }

    if (!sheets.SECTION_SHEETS[section]) {
      return res.status(400).json({ error: 'Invalid section' });
    }

    const result = await sheets.getContentItems(section, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      search,
      includeTotal: true
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching section:', error);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

// Add content item (admin only)
router.post('/content/:section', isAdmin, async (req, res) => {
  try {
    const { section } = req.params;
    const { title, url, source } = req.body;

    if (!title || !url) {
      return res.status(400).json({ error: 'Title and URL are required' });
    }

    if (section === 'research') {
      const researcher = await sheets.addResearcher({
        name: req.body.name,
        institution: req.body.institution,
        researchArea: req.body.researchArea,
        profileUrl: req.body.profileUrl,
        recentPublication: title,
        publicationUrl: url
      });
      return res.json(researcher);
    }

    if (!sheets.SECTION_SHEETS[section]) {
      return res.status(400).json({ error: 'Invalid section' });
    }

    const item = await sheets.addContentItem(section, {
      title,
      url,
      source: source || '',
      addedBy: req.user.email
    });

    res.json(item);
  } catch (error) {
    console.error('Error adding content:', error);
    res.status(500).json({ error: 'Failed to add content' });
  }
});

// Update content item (admin only)
router.put('/content/:section/:id', isAdmin, async (req, res) => {
  try {
    const { section, id } = req.params;
    const updates = req.body;

    if (!sheets.SECTION_SHEETS[section]) {
      return res.status(400).json({ error: 'Invalid section' });
    }

    const item = await sheets.updateContentItem(section, id, updates);
    res.json(item);
  } catch (error) {
    console.error('Error updating content:', error);
    res.status(500).json({ error: 'Failed to update content' });
  }
});

// Delete content item (admin only)
router.delete('/content/:section/:id', isAdmin, async (req, res) => {
  try {
    const { section, id } = req.params;

    if (!sheets.SECTION_SHEETS[section]) {
      return res.status(400).json({ error: 'Invalid section' });
    }

    await sheets.deleteContentItem(section, id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting content:', error);
    res.status(500).json({ error: 'Failed to delete content' });
  }
});

// Get current user info
router.get('/me', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      authenticated: true,
      user: {
        name: req.user.name,
        email: req.user.email,
        isAdmin: req.user.isAdmin
      }
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Helper function to generate RSS XML
function generateRSS(title, description, link, items) {
  const escapeXml = (str) => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const itemsXml = items.map(item => {
    const pubDate = item.dateAdded ? new Date(item.dateAdded).toUTCString() : new Date().toUTCString();
    return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.url)}</link>
      <guid isPermaLink="true">${escapeXml(item.url)}</guid>
      <pubDate>${pubDate}</pubDate>
      <source url="${escapeXml(link)}">${escapeXml(item.source || 'Field Notes')}</source>
    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <description>${escapeXml(description)}</description>
    <link>${escapeXml(link)}</link>
    <atom:link href="${escapeXml(link)}" rel="self" type="application/rss+xml"/>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${itemsXml}
  </channel>
</rss>`;
}

// Helper to fetch Tech Policy Press RSS feed
async function fetchTppFeed() {
  try {
    const response = await fetch('https://www.techpolicy.press/rss/feed.xml');
    const xml = await response.text();
    const items = [];
    const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
    for (const itemXml of itemMatches.slice(0, 50)) {
      const title = (itemXml.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/) || [])[1] || '';
      const link = (itemXml.match(/<link>(.*?)<\/link>/) || [])[1] || '';
      const pubDate = (itemXml.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
      if (title && link) {
        items.push({
          title: title.replace(/<!\[CDATA\[|\]\]>/g, ''),
          url: link,
          source: 'Tech Policy Press',
          dateAdded: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString()
        });
      }
    }
    return items;
  } catch (err) {
    console.error('Error fetching TPP feed:', err);
    return [];
  }
}

// RSS feed for all sections combined
router.get('/rss', async (req, res) => {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const limit = 50;

    const [news, ideas, reports, documents, podcasts, tppItems] = await Promise.all([
      sheets.getContentItems('news', { limit }),
      sheets.getContentItems('ideas', { limit }),
      sheets.getContentItems('reports', { limit }),
      sheets.getContentItems('documents', { limit }),
      sheets.getContentItems('podcasts', { limit }),
      fetchTppFeed()
    ]);

    // Combine and sort by date
    const allItems = [...news, ...ideas, ...reports, ...documents, ...podcasts, ...tppItems]
      .sort((a, b) => new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0))
      .slice(0, 100);

    const rss = generateRSS(
      'Field Notes - Tech Policy Press',
      'Curated tech policy news, ideas, reports, documents, and podcasts from Tech Policy Press',
      baseUrl,
      allItems
    );

    res.set('Content-Type', 'application/rss+xml');
    res.send(rss);
  } catch (error) {
    console.error('Error generating RSS feed:', error);
    res.status(500).send('Failed to generate RSS feed');
  }
});

// RSS feed for a specific section
router.get('/rss/:section', async (req, res) => {
  try {
    const { section } = req.params;
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const sectionTitles = {
      news: 'News',
      ideas: 'Ideas',
      reports: 'Reports',
      documents: 'Documents',
      podcasts: 'Podcasts'
    };

    if (!sectionTitles[section]) {
      return res.status(400).send('Invalid section');
    }

    const items = await sheets.getContentItems(section, { limit: 100 });

    const rss = generateRSS(
      `Field Notes: ${sectionTitles[section]} - Tech Policy Press`,
      `${sectionTitles[section]} from Field Notes by Tech Policy Press`,
      `${baseUrl}/section/${section}`,
      items
    );

    res.set('Content-Type', 'application/rss+xml');
    res.send(rss);
  } catch (error) {
    console.error('Error generating RSS feed:', error);
    res.status(500).send('Failed to generate RSS feed');
  }
});

module.exports = router;
