const express = require("express");
const fileUpload = require("express-fileupload");
const app = express();
const cors = require("cors");
const path = require("path");

// Middleware
app.use(cors());
app.use(express.json());

app.use(express.json());
app.use(fileUpload()); // Handles file uploads
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

// Route to serve the test page directly on "/"
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "test.html"));
});

// Route Imports
const exportRoutes = require("./routes/export");
const transactionRoutes = require("./routes/transactions");
// const balanceRoutes = require("./routes/balance");
// const notificationRoutes = require("./routes/notifications");
const integrationRoutes = require("./routes/integrations"); //first to be implemeted
const cronRoutes = require("./routes/cron");
// const userRoutes = require("./routes/users"); //not needed
// const analysisRoutes=require("./routes/analysis") //might be done in abeseloms code

// Route Usage
app.use("/api/transactions", transactionRoutes);
// app.use("/api/balance", balanceRoutes);
// app.use("/api/notifications", notificationRoutes);
app.use("/api/integrations", integrationRoutes);
app.use("/api/cron", cronRoutes);
app.use("/api/export", exportRoutes);
// app.use("/api/analysis", analysisRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
