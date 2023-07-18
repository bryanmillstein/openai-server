const express = require("express");

const { Configuration, OpenAIApi } = require("openai-edge");
const { OpenAIStream, StreamingTextResponse } = require("ai");

const bodyParser = require("body-parser");
const cors = require("cors");

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI API configuration
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Configure Express.js middleware to parse JSON
app.use(bodyParser.json());
app.use(cors());

app.post("/api/chat", async (req, res) => {
    console.log("chat request handler: ", req.body);

    const { model, messages } = req.body;
  // Create a chat completion using OpenAIApi
  const response = await openai.createChatCompletion({
    model: model,
    stream: true,
    messages,
  });

  // Transform the response into a readable stream
  const stream = OpenAIStream(response);

  // Return a StreamingTextResponse, which can be consumed by the client
  return new StreamingTextResponse(stream);
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
