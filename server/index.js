const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');
const fs = require('fs');

// Load config
const configPath = path.join(__dirname, '..', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: config.session_secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport setup
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Google OAuth Strategy
if (config.google_client_id !== 'YOUR_GOOGLE_CLIENT_ID') {
  passport.use(new GoogleStrategy({
    clientID: config.google_client_id,
    clientSecret: config.google_client_secret,
    callbackURL: '/auth/google/callback'
  }, (accessToken, refreshToken, profile, done) => {
    const email = profile.emails[0].value;
    const user = {
      id: profile.id,
      email: email,
      name: profile.displayName,
      isAdmin: config.admin_emails.includes(email)
    };
    return done(null, user);
  }));
}

// Static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// Auth routes
const authRoutes = require('./routes/auth');
app.use('/auth', authRoutes);

// Admin routes
const adminRoutes = require('./routes/admin');
app.use('/admin', adminRoutes);

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Serve section pages
app.get('/section/:section', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'section.html'));
});

// Start server
const PORT = process.env.PORT || config.port || 3000;
app.listen(PORT, () => {
  console.log(`Tech Policy Wire running on http://localhost:${PORT}`);
});
