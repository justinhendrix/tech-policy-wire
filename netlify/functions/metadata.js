// Fetch metadata from a URL
exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    const { url } = event.queryStringParameters || {};

    if (!url) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'URL parameter required' })
      };
    }

    // Fetch the URL
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FieldNotesBot/1.0)'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }

    const html = await response.text();

    // Extract title from HTML
    let title = '';

    // Try og:title first
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
    if (ogTitleMatch) {
      title = ogTitleMatch[1];
    }

    // Fall back to <title> tag
    if (!title) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1];
      }
    }

    // Clean up title
    title = title
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .trim();

    // Extract source (site name) from og:site_name or domain
    let source = '';

    const siteNameMatch = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i) ||
                          html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:site_name["']/i);
    if (siteNameMatch) {
      source = siteNameMatch[1];
    }

    // Fall back to domain name
    if (!source) {
      try {
        const urlObj = new URL(url);
        source = urlObj.hostname
          .replace(/^www\./, '')
          .split('.')[0]
          .charAt(0).toUpperCase() + urlObj.hostname.replace(/^www\./, '').split('.')[0].slice(1);
      } catch (e) {
        source = '';
      }
    }

    // Clean up source
    source = source
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .trim();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ title, source, url })
    };

  } catch (error) {
    console.error('Metadata fetch error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch metadata', message: error.message })
    };
  }
};
