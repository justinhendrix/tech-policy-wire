# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tech Policy Wire (Field Notes) is a Node.js web application that aggregates tech policy news, ideas, reports, research, documents, and podcasts. It uses Google Sheets as the database and Google OAuth for admin authentication.

## Commands

```bash
npm install          # Install dependencies
npm start            # Start production server (port 3000)
npm run dev          # Start with --watch for auto-reload
```

## Architecture

### Backend (server/)
- **index.js** - Express app entry point, configures middleware and mounts routes
- **routes/api.js** - REST API for CRUD operations on content sections
- **routes/auth.js** - Google OAuth flow with Passport.js
- **routes/admin.js** - Admin dashboard routes
- **middleware/auth.js** - `isAuthenticated` and `isAdmin` middleware
- **services/sheets.js** - Google Sheets API abstraction layer

### Frontend (public/)
- **index.html** - Homepage with 6-column layout for content sections
- **admin.html** - Admin panel for content management
- **section.html** - Full-page view for individual sections
- **submit.html** - Public submission form
- **js/main.js** - Client-side rendering, search (300ms debounce)
- **js/admin.js** - Admin form handling

### Browser Extension (extension/)
Chrome extension (Manifest v3) for clipping pages to the submission queue. Uses activeTab permission only.

## Data Model

Content is stored in Google Sheets with sections: News, Ideas, Reports, Documents, Podcasts, Researchers.

**Content columns:** ID, Date Added, Title, URL, Source, Added By, Status
**Researchers columns:** ID, Name, Institution, Research Area, Profile URL, Recent Publication, Publication URL, Status

Status values: "active" (visible) or "archived" (soft delete)

## Key Patterns

- **Google Sheets as database** - All data access goes through services/sheets.js
- **Config-driven** - Credentials, admin emails, sheet IDs stored in config.json
- **UUID for IDs** - All content items use UUID v4
- **Client-side rendering** - Frontend fetches JSON and renders dynamically
- **Column balancing** - Homepage uses height-based balancing across 6 columns

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/content | - | All sections for homepage |
| GET | /api/content/:section | - | Section items with pagination |
| POST | /api/content/:section | Admin | Add item |
| PUT | /api/content/:section/:id | Admin | Update item |
| DELETE | /api/content/:section/:id | Admin | Archive item |
| GET | /api/me | - | Current user info |

## Deployment

Deployed to Netlify with serverless functions. Push to GitHub triggers auto-deploy. OAuth redirect URIs must be updated for production domain.
