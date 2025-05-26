const express = require("express");
const app = express();
const cors = require("cors");

// Middleware
app.use(cors());
app.use(express.json());

// Route Imports
const transactionRoutes = require("./routes/transactions");
// const balanceRoutes = require("./routes/balance");
const notificationRoutes = require("./routes/notifications");
const integrationRoutes = require("./routes/integrations");
const cronRoutes = require("./routes/cron");
// const userRoutes = require("./routes/users"); //not needed
// const analysisRoutes=require("./routes/analysis") //might be done in abeseloms code

// Route Usage
app.use("/api/transactions", transactionRoutes);
// app.use("/api/balance", balanceRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/integrations", integrationRoutes);
app.use("/api/cron", cronRoutes);
// app.use("/api/users", userRoutes);
// app.use("/api/analysis", analysisRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
