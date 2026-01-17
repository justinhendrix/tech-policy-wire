// Tech Policy Wire - Admin JavaScript

const API_BASE = '/api';
const ITEMS_PER_PAGE = 25;

// Track pagination state per section
let currentSection = 'news';
let displayedCount = 0;
let allItems = [];

// Load user info
async function loadUserInfo() {
  const userInfo = document.getElementById('user-info');
  userInfo.textContent = 'Admin Mode';
}

// Fetch metadata from URL
async function fetchMetadata(url) {
  try {
    const response = await fetch(`${API_BASE}/metadata?url=${encodeURIComponent(url)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch metadata');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching metadata:', error);
    return null;
  }
}

// Debounce function
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

// Toggle form fields based on section
function toggleFormFields(section) {
  const contentFields = document.getElementById('content-fields');
  const researchFields = document.getElementById('research-fields');

  if (section === 'research') {
    contentFields.style.display = 'none';
    researchFields.style.display = 'block';
  } else {
    contentFields.style.display = 'block';
    researchFields.style.display = 'none';
  }
}

// Clear the form
function clearForm() {
  const form = document.getElementById('add-form');
  form.reset();
  document.getElementById('edit-id').value = '';
  document.getElementById('form-title').textContent = 'Add New Item';
  document.getElementById('submit-btn').textContent = 'Add Item';
  document.getElementById('cancel-edit-btn').style.display = 'none';
  document.getElementById('section').disabled = false;
  // Clear date fields
  document.getElementById('date-added').value = '';
  document.getElementById('research-date-added').value = '';
  toggleFormFields('news');
}

// Populate form for editing
function populateFormForEdit(item, section) {
  document.getElementById('edit-id').value = item.id;
  document.getElementById('section').value = section;
  document.getElementById('section').disabled = true;
  document.getElementById('form-title').textContent = 'Edit Item';
  document.getElementById('submit-btn').textContent = 'Update Item';
  document.getElementById('cancel-edit-btn').style.display = 'inline-block';

  toggleFormFields(section);

  if (section === 'research') {
    document.getElementById('research-title').value = item.title || '';
    document.getElementById('research-url').value = item.url || '';
    document.getElementById('research-source').value = item.source || '';
    document.getElementById('authors').value = item.authors || '';
    document.getElementById('institutions').value = item.institutions || '';
    // Set the date field if available (format: YYYY-MM-DD for date input)
    if (item.dateAdded) {
      const date = new Date(item.dateAdded);
      document.getElementById('research-date-added').value = date.toISOString().split('T')[0];
    }
  } else {
    document.getElementById('title').value = item.title || '';
    document.getElementById('url').value = item.url || '';
    document.getElementById('source').value = item.source || '';
    // Set the date field if available (format: YYYY-MM-DD for date input)
    if (item.dateAdded) {
      const date = new Date(item.dateAdded);
      document.getElementById('date-added').value = date.toISOString().split('T')[0];
    }
  }

  // Scroll to form
  document.querySelector('.admin-form').scrollIntoView({ behavior: 'smooth' });
}

// Render a single item row
function renderItemRow(item, section) {
  const tr = document.createElement('tr');

  // Title cell with link
  const titleTd = document.createElement('td');
  const titleLink = document.createElement('a');

  titleLink.href = item.url || '#';
  titleLink.textContent = item.title || 'Untitled';

  titleLink.target = '_blank';
  titleTd.appendChild(titleLink);
  tr.appendChild(titleTd);

  // Source cell
  const sourceTd = document.createElement('td');
  sourceTd.textContent = item.source || '-';
  tr.appendChild(sourceTd);

  // Date cell
  const dateTd = document.createElement('td');
  if (item.dateAdded) {
    const date = new Date(item.dateAdded);
    dateTd.textContent = date.toLocaleDateString();
  } else {
    dateTd.textContent = '-';
  }
  tr.appendChild(dateTd);

  // Actions cell
  const actionsTd = document.createElement('td');
  actionsTd.className = 'admin-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'btn btn-outline';
  editBtn.textContent = 'Edit';
  editBtn.onclick = () => populateFormForEdit(item, section);
  actionsTd.appendChild(editBtn);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-danger';
  deleteBtn.textContent = 'Delete';
  deleteBtn.onclick = () => deleteItem(section, item.id);
  actionsTd.appendChild(deleteBtn);

  tr.appendChild(actionsTd);
  return tr;
}

// Render the "Show More" button row
function renderShowMoreRow(section) {
  const tr = document.createElement('tr');
  tr.id = 'show-more-row';
  const td = document.createElement('td');
  td.colSpan = 4;
  td.style.textAlign = 'center';
  td.style.padding = '1rem';

  const btn = document.createElement('button');
  btn.className = 'btn btn-outline';
  btn.textContent = `Show More (${allItems.length - displayedCount} remaining)`;
  btn.onclick = () => showMoreItems(section);
  td.appendChild(btn);
  tr.appendChild(td);
  return tr;
}

// Show more items
function showMoreItems(section) {
  const tbody = document.getElementById('items-table');

  // Remove the "Show More" row
  const showMoreRow = document.getElementById('show-more-row');
  if (showMoreRow) {
    showMoreRow.remove();
  }

  // Add the next batch of items
  const nextBatch = allItems.slice(displayedCount, displayedCount + ITEMS_PER_PAGE);
  nextBatch.forEach(item => {
    tbody.appendChild(renderItemRow(item, section));
  });
  displayedCount += nextBatch.length;

  // Add "Show More" if there are more items
  if (displayedCount < allItems.length) {
    tbody.appendChild(renderShowMoreRow(section));
  }
}

// Load items for a section
async function loadItems(section) {
  const tbody = document.getElementById('items-table');
  tbody.innerHTML = '<tr><td colspan="4" class="loading">Loading...</td></tr>';

  // Reset pagination state
  currentSection = section;
  displayedCount = 0;
  allItems = [];

  try {
    // Add cache-busting timestamp for admin to always get fresh data
    // Fetch all items (no limit) so we can paginate client-side
    const response = await fetch(`${API_BASE}/content/${section}?_t=${Date.now()}`);
    const items = await response.json();

    tbody.innerHTML = '';

    if (!items || items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4">No items found</td></tr>';
      return;
    }

    allItems = items;

    // Render first batch
    const firstBatch = allItems.slice(0, ITEMS_PER_PAGE);
    firstBatch.forEach(item => {
      tbody.appendChild(renderItemRow(item, section));
    });
    displayedCount = firstBatch.length;

    // Add "Show More" if there are more items
    if (displayedCount < allItems.length) {
      tbody.appendChild(renderShowMoreRow(section));
    }
  } catch (error) {
    console.error('Error loading items:', error);
    tbody.innerHTML = '<tr><td colspan="4" class="error">Failed to load items</td></tr>';
  }
}

// Add or update item
async function addItem(e) {
  e.preventDefault();

  const form = e.target;
  const status = document.getElementById('form-status');
  const section = form.section.value;
  const editId = document.getElementById('edit-id').value;
  const isEdit = !!editId;

  let data;

  if (section === 'research') {
    data = {
      title: document.getElementById('research-title').value.trim(),
      url: document.getElementById('research-url').value.trim(),
      source: document.getElementById('research-source').value.trim(),
      authors: document.getElementById('authors').value.trim(),
      institutions: document.getElementById('institutions').value.trim()
    };
    // Include custom date if provided
    const researchDateValue = document.getElementById('research-date-added').value;
    if (researchDateValue) {
      data.dateAdded = new Date(researchDateValue).toISOString();
    }

    if (!data.title || !data.url) {
      status.textContent = 'Title and URL are required';
      status.style.color = '#cc0000';
      return;
    }
  } else {
    data = {
      title: document.getElementById('title').value.trim(),
      url: document.getElementById('url').value.trim(),
      source: document.getElementById('source').value.trim()
    };
    // Include custom date if provided
    const dateValue = document.getElementById('date-added').value;
    if (dateValue) {
      data.dateAdded = new Date(dateValue).toISOString();
    }

    if (!data.title || !data.url) {
      status.textContent = 'Title and URL are required';
      status.style.color = '#cc0000';
      return;
    }
  }

  status.textContent = isEdit ? 'Updating...' : 'Adding...';
  status.style.color = '#666666';

  try {
    let response;

    if (isEdit) {
      response = await fetch(`${API_BASE}/content/${section}/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } else {
      response = await fetch(`${API_BASE}/content/${section}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || (isEdit ? 'Failed to update item' : 'Failed to add item'));
    }

    status.textContent = isEdit ? 'Updated successfully!' : 'Added successfully!';
    status.style.color = '#008800';

    // Clear form and reload
    clearForm();

    const filterSection = document.getElementById('filter-section').value;
    if (filterSection === section) {
      loadItems(section);
    }

    setTimeout(() => {
      status.textContent = '';
    }, 3000);

  } catch (error) {
    console.error('Error:', error);
    status.textContent = error.message || (isEdit ? 'Failed to update item' : 'Failed to add item');
    status.style.color = '#cc0000';
  }
}

// Delete item
async function deleteItem(section, id) {
  if (!confirm('Are you sure you want to delete this item?')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/content/${section}/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error('Failed to delete item');
    }

    loadItems(section);

  } catch (error) {
    console.error('Error deleting item:', error);
    alert('Failed to delete item');
  }
}

// Load pending submissions
async function loadSubmissions() {
  const tbody = document.getElementById('submissions-table');
  const tableContainer = document.getElementById('submissions-table-container');
  const emptyMessage = document.getElementById('submissions-empty');
  const countSpan = document.getElementById('submissions-count');

  try {
    // Add cache-busting timestamp for admin to always get fresh data
    const response = await fetch(`${API_BASE}/submissions?_t=${Date.now()}`);
    const items = await response.json();

    if (!items || items.length === 0) {
      tableContainer.style.display = 'none';
      emptyMessage.style.display = 'block';
      countSpan.textContent = '';
      return;
    }

    countSpan.textContent = `(${items.length})`;
    emptyMessage.style.display = 'none';
    tableContainer.style.display = 'table';
    tbody.innerHTML = '';

    items.forEach(item => {
      const tr = document.createElement('tr');

      // Title cell with link
      const titleTd = document.createElement('td');
      const titleLink = document.createElement('a');
      titleLink.href = item.url || '#';
      titleLink.textContent = item.title || item.url || 'Untitled';
      titleLink.target = '_blank';
      titleTd.appendChild(titleLink);
      if (item.source) {
        const sourceSpan = document.createElement('span');
        sourceSpan.style.cssText = 'display: block; font-size: 0.8rem; color: #666;';
        sourceSpan.textContent = item.source;
        titleTd.appendChild(sourceSpan);
      }
      if (item.notes) {
        const notesSpan = document.createElement('span');
        notesSpan.style.cssText = 'display: block; font-size: 0.75rem; color: #999; font-style: italic;';
        notesSpan.textContent = `"${item.notes}"`;
        titleTd.appendChild(notesSpan);
      }
      tr.appendChild(titleTd);

      // Section cell
      const sectionTd = document.createElement('td');
      sectionTd.textContent = item.section || '-';
      tr.appendChild(sectionTd);

      // Date cell
      const dateTd = document.createElement('td');
      if (item.dateSubmitted) {
        const date = new Date(item.dateSubmitted);
        dateTd.textContent = date.toLocaleDateString();
      } else {
        dateTd.textContent = '-';
      }
      tr.appendChild(dateTd);

      // Actions cell
      const actionsTd = document.createElement('td');
      actionsTd.className = 'admin-actions';

      const approveBtn = document.createElement('button');
      approveBtn.className = 'btn';
      approveBtn.textContent = 'Publish';
      approveBtn.style.cssText = 'background: #008800; margin-right: 0.25rem;';
      approveBtn.onclick = () => approveSubmission(item.id);
      actionsTd.appendChild(approveBtn);

      const dismissBtn = document.createElement('button');
      dismissBtn.className = 'btn btn-outline';
      dismissBtn.textContent = 'Dismiss';
      dismissBtn.onclick = () => dismissSubmission(item.id);
      actionsTd.appendChild(dismissBtn);

      tr.appendChild(actionsTd);
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error('Error loading submissions:', error);
    tableContainer.style.display = 'none';
    emptyMessage.style.display = 'block';
    emptyMessage.textContent = 'Failed to load submissions';
  }
}

// Approve a submission
async function approveSubmission(id) {
  if (!confirm('Publish this submission?')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/submissions/${id}/approve`, {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error('Failed to approve submission');
    }

    loadSubmissions();
    // Reload the current section in case it was added there
    const filterSection = document.getElementById('filter-section').value;
    loadItems(filterSection);

  } catch (error) {
    console.error('Error approving submission:', error);
    alert('Failed to publish submission');
  }
}

// Dismiss a submission
async function dismissSubmission(id) {
  if (!confirm('Dismiss this submission? This cannot be undone.')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/submissions/${id}/dismiss`, {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error('Failed to dismiss submission');
    }

    loadSubmissions();

  } catch (error) {
    console.error('Error dismissing submission:', error);
    alert('Failed to dismiss submission');
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadUserInfo();
  loadSubmissions();
  loadItems('news');

  // Form submission
  const form = document.getElementById('add-form');
  if (form) {
    form.addEventListener('submit', addItem);
  }

  // Section select change - toggle fields
  const sectionSelect = document.getElementById('section');
  if (sectionSelect) {
    sectionSelect.addEventListener('change', (e) => {
      toggleFormFields(e.target.value);
    });
  }

  // Cancel edit button
  const cancelBtn = document.getElementById('cancel-edit-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', clearForm);
  }

  // Filter section change
  const filterSection = document.getElementById('filter-section');
  if (filterSection) {
    filterSection.addEventListener('change', (e) => {
      loadItems(e.target.value);
    });
  }

  // Auto-fetch metadata when URL is entered
  const urlInput = document.getElementById('url');
  const titleInput = document.getElementById('title');
  const sourceInput = document.getElementById('source');
  const formStatus = document.getElementById('form-status');

  if (urlInput) {
    const handleUrlChange = debounce(async (url) => {
      if (!url || !url.startsWith('http')) return;
      if (titleInput.value.trim()) return;

      formStatus.textContent = 'Fetching metadata...';
      formStatus.style.color = '#666666';

      const metadata = await fetchMetadata(url);

      if (metadata) {
        if (metadata.title && !titleInput.value.trim()) {
          titleInput.value = metadata.title;
        }
        if (metadata.source && !sourceInput.value.trim()) {
          sourceInput.value = metadata.source;
        }
        formStatus.textContent = 'Metadata loaded';
        formStatus.style.color = '#008800';
      } else {
        formStatus.textContent = 'Could not fetch metadata';
        formStatus.style.color = '#cc0000';
      }

      setTimeout(() => {
        formStatus.textContent = '';
      }, 2000);
    }, 500);

    urlInput.addEventListener('input', (e) => {
      handleUrlChange(e.target.value.trim());
    });

    urlInput.addEventListener('paste', () => {
      setTimeout(() => {
        handleUrlChange(urlInput.value.trim());
      }, 100);
    });
  }

  // Auto-fetch metadata for Research URL field
  const researchUrlInput = document.getElementById('research-url');
  const researchTitleInput = document.getElementById('research-title');
  const researchSourceInput = document.getElementById('research-source');

  if (researchUrlInput) {
    const handleResearchUrlChange = debounce(async (url) => {
      if (!url || !url.startsWith('http')) return;
      if (researchTitleInput.value.trim()) return;

      formStatus.textContent = 'Fetching metadata...';
      formStatus.style.color = '#666666';

      const metadata = await fetchMetadata(url);

      if (metadata) {
        if (metadata.title && !researchTitleInput.value.trim()) {
          researchTitleInput.value = metadata.title;
        }
        if (metadata.source && !researchSourceInput.value.trim()) {
          researchSourceInput.value = metadata.source;
        }
        formStatus.textContent = 'Metadata loaded';
        formStatus.style.color = '#008800';
      } else {
        formStatus.textContent = 'Could not fetch metadata';
        formStatus.style.color = '#cc0000';
      }

      setTimeout(() => {
        formStatus.textContent = '';
      }, 2000);
    }, 500);

    researchUrlInput.addEventListener('input', (e) => {
      handleResearchUrlChange(e.target.value.trim());
    });

    researchUrlInput.addEventListener('paste', () => {
      setTimeout(() => {
        handleResearchUrlChange(researchUrlInput.value.trim());
      }, 100);
    });
  }
});
