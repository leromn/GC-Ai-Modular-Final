// controllers/exportController.js
const db = require("../Finnished/firebase/firebaseClient"); // Adjust path
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

/**
 * Calculates start and end dates based on a predefined range string or custom dates.
 * Returns dates as JavaScript Date objects, intended to be UTC for query construction.
 */
function calculateDateRange(range, startDateStr, endDateStr) {
  const now = new Date(); // Current local time
  let calculatedStartDate, calculatedEndDate;

  if (startDateStr && endDateStr) {
    try {
      // Parse custom dates, assuming they are YYYY-MM-DD
      // These will be local to the server if no timezone info is in the string
      const [sYear, sMonth, sDay] = startDateStr.split("-").map(Number);
      const [eYear, eMonth, eDay] = endDateStr.split("-").map(Number);

      // Construct dates as UTC midnight and UTC end-of-day
      calculatedStartDate = new Date(
        Date.UTC(sYear, sMonth - 1, sDay, 0, 0, 0, 0)
      );
      calculatedEndDate = new Date(
        Date.UTC(eYear, eMonth - 1, eDay, 23, 59, 59, 999)
      );

      if (
        isNaN(calculatedStartDate.getTime()) ||
        isNaN(calculatedEndDate.getTime())
      ) {
        throw new Error("Invalid custom date components");
      }
    } catch (e) {
      console.error("Error parsing custom date strings:", e.message);
      return null;
    }
  } else {
    // For predefined ranges, calculate based on 'now' (local) then convert to UTC boundaries
    let tempStartDate = new Date(now);
    let tempEndDate = new Date(now);

    switch (range?.toLowerCase()) {
      case "lastweek":
        tempStartDate.setUTCDate(now.getUTCDate() - 7);
        break;
      case "lastmonth":
        tempStartDate.setUTCMonth(now.getUTCMonth() - 1);
        break;
      case "lastyear":
        tempStartDate.setUTCFullYear(now.getUTCFullYear() - 1);
        break;
      case "alltime":
        tempStartDate = new Date(0); // Unix epoch (already UTC)
        break;
      default: // Default to last month
        if (range)
          console.warn(`Invalid range: '${range}', defaulting to last month.`);
        tempStartDate.setUTCMonth(now.getUTCMonth() - 1);
        break;
    }
    // Construct UTC start and end for predefined ranges
    calculatedStartDate = new Date(
      Date.UTC(
        tempStartDate.getUTCFullYear(),
        tempStartDate.getUTCMonth(),
        tempStartDate.getUTCDate(),
        0,
        0,
        0,
        0
      )
    );
    calculatedEndDate = new Date(
      Date.UTC(
        tempEndDate.getUTCFullYear(),
        tempEndDate.getUTCMonth(),
        tempEndDate.getUTCDate(),
        23,
        59,
        59,
        999
      )
    );

    if (range === "alltime") {
      // For all time, end date should be 'now' effectively
      calculatedEndDate = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          23,
          59,
          59,
          999
        )
      );
    }
  }

  if (calculatedStartDate > calculatedEndDate) {
    console.error("Calculated startDate is after endDate.");
    return null;
  }
  return { startDate: calculatedStartDate, endDate: calculatedEndDate };
}

async function fetchAllTransactionsInRange(userId, startDate, endDate) {
  const transactionsCollectionRef = db.collection("allUserTransactions");
  let allTransactions = [];
  let lastVisible = null;
  const BATCH_SIZE = 500;

  // Convert JS Date objects to ISO strings for comparison if 'date' field is an ISO string
  const queryStartDateStr = startDate.toISOString();
  const queryEndDateStr = endDate.toISOString();

  console.log(
    `[fetchAllTransactionsInRange] Querying for user ${userId} between ${queryStartDateStr} and ${queryEndDateStr}`
  );

  let query = transactionsCollectionRef
    .where("userId", "==", userId)
    .where("date", ">=", queryStartDateStr) // Compare string with string
    .where("date", "<=", queryEndDateStr) // Compare string with string
    .orderBy("date", "desc")
    .limit(BATCH_SIZE);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (lastVisible) {
      query = query.startAfter(lastVisible);
    }
    const snapshot = await query.get();
    if (snapshot.empty) {
      console.log(
        "[fetchAllTransactionsInRange] Snapshot empty, breaking loop."
      );
      break;
    }
    snapshot.forEach((doc) => {
      allTransactions.push({ id: doc.id, ...doc.data() });
    });
    console.log(
      `[fetchAllTransactionsInRange] Fetched batch of ${snapshot.size} transactions.`
    );
    if (snapshot.size < BATCH_SIZE) {
      console.log("[fetchAllTransactionsInRange] Last batch fetched.");
      break;
    }
    lastVisible = snapshot.docs[snapshot.docs.length - 1];
  }
  console.log(
    `[fetchAllTransactionsInRange] Fetched a total of ${allTransactions.length} transactions for user ${userId}.`
  );
  return allTransactions;
}

async function exportUserTransactions(req, res) {
  try {
    const userId = req.user?.uid || req.query?.testUserIdForExport;

    if (!userId) {
      if (res && typeof res.status === "function")
        return res
          .status(401)
          .json({ error: "Unauthorized. User ID missing." });
      else {
        console.error("Unauthorized. User ID missing.");
        throw new Error("Unauthorized.");
      }
    }

    const {
      range,
      startDate: startDateStr,
      endDate: endDateStr,
    } = req.query || {};
    const dateRange = calculateDateRange(range, startDateStr, endDateStr);

    if (!dateRange) {
      const errorMsg =
        "Invalid date range. Ensure YYYY-MM-DD format, and startDate is before endDate.";
      if (res && typeof res.status === "function")
        return res.status(400).json({ error: errorMsg });
      else {
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
    }

    const { startDate, endDate } = dateRange;

    console.log(
      `Request to export ALL transactions for user ${userId} from ${startDate.toISOString()} (UTC) to ${endDate.toISOString()} (UTC) as Excel.`
    );

    const allFetchedTransactions = await fetchAllTransactionsInRange(
      userId,
      startDate,
      endDate
    );

    if (allFetchedTransactions.length === 0) {
      const noDataMsg =
        "No transactions found for the given criteria to export.";
      console.log(noDataMsg + ` for user ${userId}`);
      if (res && typeof res.status === "function") {
        return res.status(200).json({
          message: noDataMsg,
          queryRange: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          },
        });
      } else {
        console.log(noDataMsg);
        return { message: noDataMsg, filename: null };
      }
    }

    const transactionsForExcel = allFetchedTransactions.map((data) => {
      let displayDate = data.date; // This is already an ISO string from Firestore
      // If you want to format it differently for Excel, e.g., just YYYY-MM-DD:
      try {
        displayDate = new Date(data.date).toISOString().split("T")[0];
      } catch (e) {
        /* keep original if parsing fails */
      }

      return {
        "ID (Firestore)": data.id,
        "Transaction ID": data.txId || "N/A",
        Date: displayDate,
        // Description: data.description || "N/A",
        Amount: data.amount,
        Currency: data.currency,
        Type: data.type,
        Category: data.category || "Uncategorized",
        Source: data.source,
        Asset: data.asset,
      };
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Transactions");

    if (transactionsForExcel.length > 0) {
      const headers = Object.keys(transactionsForExcel[0]);
      worksheet.columns = headers.map((key) => ({
        header: key,
        key: key,
        width: key.length < 12 ? 12 : Math.min(key.length + 5, 50),
      }));
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD3D3D3" },
      };
      worksheet.getRow(1).alignment = {
        vertical: "middle",
        horizontal: "center",
      };
      worksheet.addRows(transactionsForExcel);
    }

    const filenameRangeStr =
      range ||
      `${startDate.toISOString().split("T")[0]}_to_${
        endDate.toISOString().split("T")[0]
      }`;
    const excelFilename = `transactions_${userId}_${filenameRangeStr}.xlsx`;

    if (
      res &&
      typeof res.setHeader === "function" &&
      typeof res.end === "function"
    ) {
      console.log(
        `Streaming Excel file "${excelFilename}" to HTTP response for user ${userId}.`
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${excelFilename}"`
      );
      await workbook.xlsx.write(res);
      res.end();
    } else {
      const outputPath = path.join(__dirname, excelFilename);
      await workbook.xlsx.writeFile(outputPath);
      console.log(`✅ Excel file saved locally: ${outputPath}`);
      return {
        message: `Excel file saved to ${outputPath}`,
        filename: excelFilename,
      };
    }
  } catch (error) {
    console.error(
      "❌ Error exporting user transactions to Excel:",
      error.message,
      error.stack
    );
    if (res && typeof res.status === "function" && !res.headersSent) {
      res
        .status(500)
        .json({ error: "Failed to export transactions to Excel." });
    } else if (res && res.headersSent) {
      console.error(
        "Headers already sent, cannot send JSON error response for Excel export."
      );
      if (typeof res.end === "function") res.end();
    } else {
      throw error;
    }
  }
}

module.exports = {
  exportUserTransactions,
};

// === TEST BLOCK for direct script execution ===
if (require.main === module) {
  (async () => {
    console.log("\n--- Running Export Controller Test (with UTC dates) ---");

    const testUserId = "k3LLnHvMbjgGlSxtzLXl9MjB63y1"; // USER ID WITH DATA

    // Test Case: lastMonth (default)
    const mockReqDefault = { query: { testUserIdForExport: testUserId } };
    console.log(
      `\n[TEST Default] Exporting for user ${testUserId} (last month)`
    );
    try {
      const resultDefault = await exportUserTransactions(mockReqDefault, null);
      if (resultDefault)
        console.log("[TEST Default] Result:", resultDefault.message);
    } catch (e) {
      console.error("[TEST Default] FAILED:", e.message, e.stack);
    }

    // Test Case: Specific date range where you know data exists
    // IMPORTANT: Adjust these YYYY-MM-DD dates to a range where `testUserId` HAS transactions
    // with dates like "2025-05-31T03:40:31.000Z"
    const knownDataStartDate = "2025-05-01"; // Example: Beginning of May 2025
    const knownDataEndDate = "2025-05-31"; // Example: End of May 2025

    const mockReqKnownRange = {
      query: {
        testUserIdForExport: testUserId,
        range: "alltime",
        // startDate: knownDataStartDate,
        // endDate: knownDataEndDate,
      },
    };
    console.log(
      `\n[TEST Known Range] Exporting for ${testUserId} (range: ${knownDataStartDate} to ${knownDataEndDate})`
    );
    try {
      const resultKnown = await exportUserTransactions(mockReqKnownRange, null);
      if (resultKnown)
        console.log("[TEST Known Range] Result:", resultKnown.message);
    } catch (e) {
      console.error("[TEST Known Range] FAILED:", e.message, e.stack);
    }

    console.log("\n--- Export Controller Test Completed ---");
  })().catch((err) => {
    console.error("❌ Test script execution failed:", err.message, err.stack);
  });
}
