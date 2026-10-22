import { createServer } from "node:http";

createServer((request, response) => {
  response.setHeader("Content-Type", "application/json");
  response.end(
    JSON.stringify({
      protocol: request.headers["x-forwarded-proto"],
      forwardedFor: request.headers["x-forwarded-for"],
      source: request.headers["x-real-ip"],
    }),
  );
}).listen(3000, "0.0.0.0");
