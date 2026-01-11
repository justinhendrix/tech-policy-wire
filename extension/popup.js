// Configuration - Update this URL to match your Netlify deployment
const API_URL = 'https://tech-policy-wire.netlify.app/api/submissions';

// DOM Elements
const form = document.getElementById('clip-form');
const titleInput = document.getElementById('title');
const urlInput = document.getElementById('url');
const sourceInput = document.getElementById('source');
const sectionSelect = document.getElementById('section');
const notesInput = document.getElementById('notes');
const submitBtn = document.getElementById('submit-btn');
const statusDiv = document.getElementById('status');
const successView = document.getElementById('success-view');
const submitAnotherBtn = document.getElementById('submit-another');

// Initialize popup with current tab info
async function initPopup() {
  try {
    // Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab) {
      // Set URL (readonly)
      urlInput.value = tab.url || '';

      // Set title
      titleInput.value = tab.title || '';

      // Try to extract source from URL hostname
      try {
        const url = new URL(tab.url);
        const hostname = url.hostname.replace('www.', '');
        // Capitalize first letter of each word
        const sourceName = hostname.split('.')[0]
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        sourceInput.value = sourceName;
      } catch (e) {
        // Ignore URL parsing errors
      }
    }
  } catch (error) {
    console.error('Error getting tab info:', error);
    statusDiv.textContent = 'Could not get page info';
    statusDiv.className = 'status error';
  }
}

// Submit the form
async function submitForm(e) {
  e.preventDefault();

  // Validate required fields
  const section = sectionSelect.value;
  const url = urlInput.value.trim();

  if (!section) {
    statusDiv.textContent = 'Please select a category';
    statusDiv.className = 'status error';
    return;
  }

  if (!url) {
    statusDiv.textContent = 'No URL available';
    statusDiv.className = 'status error';
    return;
  }

  // Prepare submission data
  const data = {
    section: section,
    url: url,
    title: titleInput.value.trim(),
    source: sourceInput.value.trim(),
    notes: notesInput.value.trim(),
    website: '' // Honeypot field - must be empty
  };

  // Update UI
  submitBtn.disabled = true;
  statusDiv.textContent = 'Submitting...';
  statusDiv.className = 'status loading';

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (response.status === 429) {
      statusDiv.textContent = 'Too many submissions. Please wait a minute.';
      statusDiv.className = 'status error';
      submitBtn.disabled = false;
      return;
    }

    if (!response.ok) {
      throw new Error('Failed to submit');
    }

    // Show success view
    form.style.display = 'none';
    successView.style.display = 'block';

  } catch (error) {
    console.error('Submission error:', error);
    statusDiv.textContent = 'Failed to submit. Please try again.';
    statusDiv.className = 'status error';
    submitBtn.disabled = false;
  }
}

// Reset form for another submission
function resetForm() {
  form.style.display = 'block';
  successView.style.display = 'none';
  sectionSelect.value = '';
  notesInput.value = '';
  statusDiv.textContent = '';
  statusDiv.className = 'status';
  submitBtn.disabled = false;

  // Re-initialize with current tab
  initPopup();
}

// Event listeners
document.addEventListener('DOMContentLoaded', initPopup);
form.addEventListener('submit', submitForm);
submitAnotherBtn.addEventListener('click', resetForm);
