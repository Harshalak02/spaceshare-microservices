require('dotenv').config();
const app = require('./src/app');
const PORT = process.env.PORT || 4002;
app.listen(PORT, () => console.log(`Listing service running on ${PORT}`));
