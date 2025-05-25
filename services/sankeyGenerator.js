const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const QuickChart = require("quickchart-js");

const sampleData = [
  { from: "Salary", to: "Bank", flow: 3000 },
  { from: "Bank", to: "Rent", flow: 1000 },
  { from: "Bank", to: "Food", flow: 500 },
  { from: "Bank", to: "Savings", flow: 1500 },
];

async function generateSankey(data = sampleData, options = {}) {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Data array is required and cannot be empty.");
  }

  const uploadsDir = path.join(__dirname, "../uploads");

  // ✅ Make sure the uploads folder exists
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const uniqueId = uuidv4();
  const filename = `sankey-${uniqueId}.png`;
  const filepath = path.join(uploadsDir, filename);

  const myChart = new QuickChart();

  const chartConfig = {
    type: "sankey",
    data: {
      datasets: [
        {
          label: options.label || "Transaction Flow",
          data: data,
        },
      ],
    },
  };

  myChart
    .setConfig(chartConfig)
    .setWidth(options.width || 800)
    .setHeight(options.height || 600)
    .setBackgroundColor(options.backgroundColor || "transparent")
    .setVersion("3.4.0");

  try {
    await myChart.toFile(filepath);
    const chartUrl = myChart.getUrl();
    console.log(chartUrl);
    return {
      filepath,
      url: chartUrl,
    };
  } catch (error) {
    console.error("❌ Error generating Sankey:", error.message);
    throw error;
  }
}

generateSankey();

module.exports = { generateSankey };
