// Tech Policy Wire - Main JavaScript

const API_BASE = '/api';

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

  // Add source below title
  if (item.source) {
    const source = document.createElement('span');
    source.className = 'source';
    source.textContent = item.source;
    li.appendChild(source);
  }

  return li;
}

// Render items into a list
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

  items.forEach(item => {
    list.appendChild(renderItem(item));
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

// Initialize search
function initSearch() {
  const searchInput = document.getElementById('search-input');
  if (!searchInput) return;

  const debouncedSearch = debounce((value) => {
    loadContent(value);
  }, 300);

  searchInput.addEventListener('input', (e) => {
    debouncedSearch(e.target.value);
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadContent();
  initSearch();
});
