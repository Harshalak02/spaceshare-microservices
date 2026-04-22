require('dotenv').config();

const app = require('./src/app');

const PORT = process.env.PORT || 4005;
app.listen(PORT, () => console.log(`Subscription service running on ${PORT}`));