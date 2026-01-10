// Tech Policy Wire - Admin JavaScript

const API_BASE = '/api';

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
  } else {
    document.getElementById('title').value = item.title || '';
    document.getElementById('url').value = item.url || '';
    document.getElementById('source').value = item.source || '';
  }

  // Scroll to form
  document.querySelector('.admin-form').scrollIntoView({ behavior: 'smooth' });
}

// Load items for a section
async function loadItems(section) {
  const tbody = document.getElementById('items-table');
  tbody.innerHTML = '<tr><td colspan="4" class="loading">Loading...</td></tr>';

  try {
    const response = await fetch(`${API_BASE}/content/${section}?limit=50`);
    const items = await response.json();

    tbody.innerHTML = '';

    if (!items || items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4">No items found</td></tr>';
      return;
    }

    items.forEach(item => {
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
      tbody.appendChild(tr);
    });
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadUserInfo();
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
