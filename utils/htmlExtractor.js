// utils/htmlExtractor.js
const puppeteer = require("puppeteer");

async function extractVisibleTextFromPage(url) {
  const browser = await puppeteer.launch({ headless: "new" }); // "new" for latest Puppeteer versions
  const page = await browser.newPage();
  console.log("puppeteer");
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    // Remove scripts, styles, and hidden elements
    const visibleText = await page.evaluate(() => {
      // Remove script/style tags from DOM
      document
        .querySelectorAll("script, style, noscript, head")
        .forEach((el) => el.remove());

      // Remove hidden elements
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_ELEMENT,
        null,
        false
      );
      while (walker.nextNode()) {
        const el = walker.currentNode;
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") {
          el.remove();
        }
      }

      return document.body.innerText;
    });

    await browser.close();
    return visibleText.trim();
  } catch (error) {
    await browser.close();
    throw error;
  }
}

module.exports = { extractVisibleTextFromPage };
