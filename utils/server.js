const { createParser } = require("eventsource-parser");
const fetch = require("node-fetch");
const { Readable } = require("stream");


const OPENAI_API_HOST = "https://api.openai.com";

class OpenAIError extends Error {
  constructor(message, type, param, code) {
    super(message);
    this.name = "OpenAIError";
    this.type = type;
    this.param = param;
    this.code = code;
  }
}

const OpenAIStream = async (model, systemPrompt, key, messages) => {
  const res = await fetch(`${OPENAI_API_HOST}/v1/chat/completions`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key ? key : process.env.OPENAI_API_KEY}`,
      ...(process.env.OPENAI_ORGANIZATION && {
        "OpenAI-Organization": process.env.OPENAI_ORGANIZATION,
      }),
    },
    method: "POST",
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        ...messages,
      ],
      max_tokens: 1000,
      temperature: 1,
      stream: true,
    }),
  });

  const encoding = new TextEncoder();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  if (res.status !== 200) {
    const result = await res.json();
    if (result.error) {
      throw new OpenAIError(
        result.error.message,
        result.error.type,
        result.error.param,
        result.error.code
      );
    } else {
      throw new Error(
        `OpenAI API returned an error: ${
          decoder.decode(result?.value) || result.statusText
        }`
      );
    }
  }

  const stream = new Readable({
    async read(size) {
      const onParse = (event) => {
        if (event.type === "event") {
          const data = event.data;

          if (data === "[DONE]") {
            this.push(null);
            return;
          }

          try {
            const json = JSON.parse(data);
            const text = json.choices[0].delta.content;
            const buffer = encoding.encode(text);
            const chunkSize = 16 * 1024;
            for (let i = 0; i < buffer.length; i += chunkSize) {
              this.push(buffer.slice(i, i + chunkSize));
            }
          } catch (e) {
            this.emit("error", e);
          }
        }
      };

      const parser = createParser(onParse);

      for await (const chunk of res.body) {
        parser.feed(decoder.decode(chunk));
      }
    },
  });

  return stream;
};

module.exports = {
  OpenAIError,
  OpenAIStream,
};