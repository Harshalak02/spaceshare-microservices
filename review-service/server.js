require("dotenv").config();
const app = require("./src/app");

const PORT = process.env.PORT || 4008;

app.listen(PORT, () => {
  console.log(`✅ Review Service running on port ${PORT}`);
});
