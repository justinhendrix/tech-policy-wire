# Tech Policy Wire (Field Notes)

A Node.js website for aggregating tech policy news, ideas, reports, research, documents, and podcasts. Uses Google Sheets as the database and Google OAuth for admin authentication.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or use an existing one
3. Enable the **Google Sheets API**
4. Create a **Service Account**:
   - Go to "IAM & Admin" > "Service Accounts"
   - Create a new service account
   - Download the JSON key file and save it as `credentials.json` in this folder
5. Create **OAuth 2.0 Credentials** (for admin login):
   - Go to "APIs & Services" > "Credentials"
   - Create an "OAuth 2.0 Client ID" (Web application)
   - Add `http://localhost:3000/auth/google/callback` as an authorized redirect URI
   - Copy the Client ID and Client Secret

### 3. Create Google Sheets

Create two Google Sheets:

**Content Sheet** (for News, Ideas, Reports, Documents, Podcasts):
- Create sheets named: `News`, `Ideas`, `Reports`, `Documents`, `Podcasts`
- Each sheet should have headers: `ID`, `Date Added`, `Title`, `URL`, `Source`, `Added By`, `Status`
- Share with the service account email (from credentials.json)

**Researchers Sheet**:
- Create a sheet named: `Researchers`
- Headers: `ID`, `Name`, `Institution`, `Research Area`, `Profile URL`, `Recent Publication`, `Publication URL`, `Status`
- Share with the service account email

### 4. Configure

Edit `config.json`:

```json
{
  "content_spreadsheet_id": "your-content-spreadsheet-id",
  "researchers_spreadsheet_id": "your-researchers-spreadsheet-id",
  "credentials_file": "credentials.json",
  "google_client_id": "your-oauth-client-id.apps.googleusercontent.com",
  "google_client_secret": "your-oauth-client-secret",
  "admin_emails": ["your-email@example.com"],
  "session_secret": "generate-a-random-string",
  "port": 3000
}
```

### 5. Run

```bash
npm start
```

Visit http://localhost:3000

## Admin Access

1. Go to http://localhost:3000/admin
2. Sign in with a Google account listed in `admin_emails`
3. Add content through the form

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/content` | Get all sections (homepage) |
| GET | `/api/content/:section` | Get items from a section |
| POST | `/api/content/:section` | Add item (admin only) |
| PUT | `/api/content/:section/:id` | Update item (admin only) |
| DELETE | `/api/content/:section/:id` | Delete item (admin only) |
| GET | `/api/me` | Get current user info |

## Deployment to Railway

1. Push to GitHub
2. Connect Railway to your repo
3. Add environment variables:
   - `NODE_ENV=production`
4. Add the `credentials.json` content as a file in Railway
5. Update OAuth redirect URI to your Railway domain

## Browser Extension (Future)

The browser extension will allow you to right-click on any page and add it to Tech Policy Wire. Coming soon!
