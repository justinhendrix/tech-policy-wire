// Tech Policy Wire - Admin JavaScript

const API_BASE = '/api';

// Load user info
async function loadUserInfo() {
  const userInfo = document.getElementById('user-info');
  userInfo.textContent = 'Admin Mode';
}

// Load items for a section
async function loadItems(section) {
  const tbody = document.getElementById('items-table');
  tbody.innerHTML = '<tr><td colspan="4" class="loading">Loading...</td></tr>';

  try {
    const response = await fetch(`${API_BASE}/content/${section}?limit=20`);
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
      titleLink.href = item.url;
      titleLink.target = '_blank';
      titleLink.textContent = item.title;
      titleTd.appendChild(titleLink);
      tr.appendChild(titleTd);

      // Source cell
      const sourceTd = document.createElement('td');
      sourceTd.textContent = item.source || '-';
      tr.appendChild(sourceTd);

      // Date cell
      const dateTd = document.createElement('td');
      const date = new Date(item.dateAdded);
      dateTd.textContent = date.toLocaleDateString();
      tr.appendChild(dateTd);

      // Actions cell
      const actionsTd = document.createElement('td');
      actionsTd.className = 'admin-actions';

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

// Add new item
async function addItem(e) {
  e.preventDefault();

  const form = e.target;
  const status = document.getElementById('form-status');

  const section = form.section.value;
  const title = form.title.value.trim();
  const url = form.url.value.trim();
  const source = form.source.value.trim();

  if (!title || !url) {
    status.textContent = 'Title and URL are required';
    status.style.color = '#cc0000';
    return;
  }

  status.textContent = 'Adding...';
  status.style.color = '#666666';

  try {
    const response = await fetch(`${API_BASE}/content/${section}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title, url, source })
    });

    if (!response.ok) {
      throw new Error('Failed to add item');
    }

    status.textContent = 'Added successfully!';
    status.style.color = '#008800';

    // Clear form
    form.title.value = '';
    form.url.value = '';
    form.source.value = '';

    // Reload items if viewing the same section
    const filterSection = document.getElementById('filter-section').value;
    if (filterSection === section) {
      loadItems(section);
    }

    // Clear status after 3 seconds
    setTimeout(() => {
      status.textContent = '';
    }, 3000);

  } catch (error) {
    console.error('Error adding item:', error);
    status.textContent = 'Failed to add item';
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

    // Reload items
    loadItems(section);

  } catch (error) {
    console.error('Error deleting item:', error);
    alert('Failed to delete item');
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadUserInfo();

  // Load initial items
  loadItems('news');

  // Form submission
  const form = document.getElementById('add-form');
  form.addEventListener('submit', addItem);

  // Section filter change
  const filterSection = document.getElementById('filter-section');
  filterSection.addEventListener('change', (e) => {
    loadItems(e.target.value);
  });
});
