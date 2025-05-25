const axios = require("axios");

const OPENAI_API_KEY =
  "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"; // Replace with your actual API key
const API_URL = "https://api.openai.com/v1/chat/completions";

async function askChatGPT(message) {
  try {
    const start = Date.now();

    const response = await axios.post(
      API_URL,
      {
        model: "gpt-4o-mini", // You can also use 'gpt-4' if you have access
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: message },
        ],
        temperature: 0.7,
        max_tokens: 500,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const end = Date.now();
    const timeTaken = ((end - start) / 1000).toFixed(2);

    console.log(
      "\n🧠 ChatGPT says:\n",
      response.data.choices[0].message.content.trim()
    );
    console.log(`\n⏱️ Response Time: ${timeTaken} seconds`);
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
  }
}

// 🧪 Test the function
askChatGPT("What are 3 fun facts about honey bees?");
