const express = require("express");

const { OpenAIError, OpenAIStream } = require("./utils/server");

const { Configuration, OpenAIApi } = require("openai");
const tiktokenModel = require("@dqbd/tiktoken/encoders/cl100k_base.json");
const { Tiktoken, init } = require("@dqbd/tiktoken/lite/init");
const fs = require("fs");
const path = require("path");

const wasmPath = path.join(
  __dirname,
  "./node_modules/@dqbd/tiktoken/lite/tiktoken_bg.wasm"
);
const wasm = fs.readFileSync(wasmPath);

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

app.get("/", (req, res) => {
  console.log('in the open ai server!')
  res.send("Hello World!");
});


app.post("/api/chat", async (req, res) => {
  console.log("chat request handler: ", req.body);
  try {
    const { model, messages, prompt } = req.body;
    const key = process.env.OPENAI_API_KEY;

    await init((imports) => WebAssembly.instantiate(wasm, imports));

    const encoding = new Tiktoken(
      tiktokenModel.bpe_ranks,
      tiktokenModel.special_tokens,
      tiktokenModel.pat_str
    );

    let promptToSend = prompt;
    if (!promptToSend) {
      promptToSend = process.env.DEFAULT_SYSTEM_PROMPT;
    }

    const prompt_tokens = encoding.encode(promptToSend);

    let tokenCount = prompt_tokens.length;
    let messagesToSend = [];

    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const tokens = encoding.encode(message.content);

      if (tokenCount + tokens.length + 1000 > model.tokenLimit) {
        break;
      }
      tokenCount += tokens.length;
      messagesToSend = [message, ...messagesToSend];
    }

    encoding.free();

    const stream = await OpenAIStream(model, promptToSend, key, messagesToSend);

    // res.status(200).send(stream);
    res.setHeader("Content-Type", "text/plain");
    res.status(200);
    stream.pipe(res);
  } catch (error) {
    console.error(error);
    if (error instanceof OpenAIError) {
      res.status(500).send(error.message);
    } else {
      res.status(500).send("Error");
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
