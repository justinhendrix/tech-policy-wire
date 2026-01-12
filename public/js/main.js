// Tech Policy Wire - Main JavaScript

const API_BASE = '/api';
const MAX_ITEMS = 10; // Maximum items per section
const EXTRA_ITEMS = 5; // Extra items to fetch for flexible fitting

// Format date for display (e.g., "Jan 12" for current year, "Jan 12, 2025" for prior years)
function formatDate(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;
  const currentYear = new Date().getFullYear();
  const options = { month: 'short', day: 'numeric' };
  if (date.getFullYear() !== currentYear) {
    options.year = 'numeric';
  }
  return date.toLocaleDateString('en-US', options);
}

// Debounce function for search
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Render a content item
function renderItem(item) {
  const li = document.createElement('li');

  // All items now have the same structure: title, url, source
  const link = document.createElement('a');
  link.href = item.url || '#';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = item.title;
  li.appendChild(link);

  // Add source and date below title
  if (item.source || item.dateAdded) {
    const source = document.createElement('span');
    source.className = 'source';

    let sourceText = item.source || '';
    const formattedDate = formatDate(item.dateAdded);
    if (formattedDate) {
      if (sourceText) {
        sourceText += ' ';
      }
      sourceText += `<span class="item-date">| ${formattedDate}</span>`;
    }
    source.innerHTML = sourceText;
    li.appendChild(source);
  }

  return li;
}

// Render items into a list, storing extras for later fitting
function renderList(listId, items) {
  const list = document.getElementById(listId);
  if (!list) return;

  list.innerHTML = '';

  if (!items || items.length === 0) {
    const li = document.createElement('li');
    li.className = 'loading';
    li.textContent = 'No items yet';
    list.appendChild(li);
    return;
  }

  // Initially render up to MAX_ITEMS
  const initialItems = items.slice(0, MAX_ITEMS);
  initialItems.forEach(item => {
    list.appendChild(renderItem(item));
  });

  // Store extra items for potential fitting
  list.dataset.extraItems = JSON.stringify(items.slice(MAX_ITEMS));
}

// Adjust item counts across columns to balance heights
function balanceColumns() {
  const columns = document.querySelectorAll('.column');
  if (columns.length === 0) return;

  // Get the tallest column height
  let maxHeight = 0;
  columns.forEach(col => {
    const list = col.querySelector('ul');
    if (list) {
      maxHeight = Math.max(maxHeight, list.scrollHeight);
    }
  });

  // For columns with extra items that are shorter, try adding more
  columns.forEach(col => {
    const list = col.querySelector('ul');
    if (!list) return;

    const extraItems = list.dataset.extraItems;
    if (!extraItems) return;

    try {
      const extras = JSON.parse(extraItems);
      if (extras.length === 0) return;

      // Check if this column is shorter and can fit more
      const currentHeight = list.scrollHeight;
      const heightDiff = maxHeight - currentHeight;

      // Estimate item height (average of current items)
      const currentItems = list.querySelectorAll('li');
      if (currentItems.length === 0) return;

      const avgItemHeight = currentHeight / currentItems.length;

      // Calculate how many more items might fit
      const potentialExtraItems = Math.floor(heightDiff / avgItemHeight);

      if (potentialExtraItems > 0) {
        const itemsToAdd = extras.slice(0, potentialExtraItems);
        itemsToAdd.forEach(item => {
          list.appendChild(renderItem(item));
        });

        // Update remaining extras
        list.dataset.extraItems = JSON.stringify(extras.slice(potentialExtraItems));
      }
    } catch (e) {
      console.error('Error parsing extra items:', e);
    }
  });
}

// Fetch and display all content
async function loadContent(search = '') {
  try {
    const url = search
      ? `${API_BASE}/content?search=${encodeURIComponent(search)}`
      : `${API_BASE}/content`;

    const response = await fetch(url);
    const data = await response.json();

    renderList('news-list', data.news);
    renderList('ideas-list', data.ideas);
    renderList('reports-list', data.reports);
    renderList('research-list', data.research);
    renderList('documents-list', data.documents);
    renderList('podcasts-list', data.podcasts);

    // After initial render, balance columns
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        balanceColumns();
      });
    });

  } catch (error) {
    console.error('Error loading content:', error);

    // Show error in all sections
    ['news', 'ideas', 'reports', 'research', 'documents', 'podcasts'].forEach(section => {
      const list = document.getElementById(`${section}-list`);
      if (list) {
        list.innerHTML = '<li class="error">Failed to load content</li>';
      }
    });
  }
}

// Initialize search - redirect to search page on submit
function initSearch() {
  const searchInput = document.getElementById('search-input');
  if (!searchInput) return;

  // Handle Enter key - redirect to search page
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = searchInput.value.trim();
      if (query) {
        window.location.href = `/search?q=${encodeURIComponent(query)}`;
      }
    }
  });
}

// Handle window resize - rebalance columns
const handleResize = debounce(() => {
  // Reload to rebalance (simple approach)
  loadContent();
}, 500);

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadContent();
  initSearch();
  window.addEventListener('resize', handleResize);
});
