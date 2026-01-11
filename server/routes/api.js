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

module.exports = router;
