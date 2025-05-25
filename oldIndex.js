const express = require("express");
const fileUpload = require("express-fileupload");
const analysisRoute = require("./routes/analysisRoute");
const path = require("path");
const connectDB = require("./database/databaseController");

const app = express();
app.use(express.json());
app.use(fileUpload()); // Handles file uploads
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

connectDB();

app.use(express.static(path.join(__dirname, "public")));

// Route to serve the test page directly on "/"
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "test.html"));
});

// Mount the route
app.use("/api/analyze", analysisRoute);

// Start serverr
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
