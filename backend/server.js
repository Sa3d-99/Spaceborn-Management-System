require('./src/config/env');
const connectDB = require('./src/config/db');

const app = require('./src/app');

// Vercel imports this file as the Express request handler. Start a listener
// only when running as a standalone Node service (for example, on Render).
if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  connectDB()
    .then(() => {
      app.listen(PORT, () => {
        const { APP_URL } = process.env;
        const address = URL.canParse(APP_URL) ? new URL(APP_URL).origin : `http://localhost:${PORT}`;
        console.log(`CRM is ready at ${address}`);
      });
    })
    .catch((error) => {
      console.error('Database initialization failed:', error);
      process.exit(1);
    });
}

module.exports = app;
