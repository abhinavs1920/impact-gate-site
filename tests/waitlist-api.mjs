import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transformWithEsbuild } from "vite";

const source = await readFile(
  new URL("../src/functions/api/waitlist.ts", import.meta.url),
  "utf8",
);
const { code } = await transformWithEsbuild(source, "waitlist.ts", {
  loader: "ts",
  format: "esm",
  target: "es2022",
});
const { onRequestPost } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
);

const post = (body) =>
  new Request("https://impactgate.in/api/waitlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

let sentMessage;
let storedValue;
const env = {
  EMAIL: {
    async send(message) {
      sentMessage = message;
      return { messageId: "test-message-id" };
    },
  },
  WAITLIST: {
    async put(key, value) {
      storedValue = { key, value };
    },
  },
};

const success = await onRequestPost({
  request: post({
    email: " applicant@example.com ",
    repository: "github.com/acme/service",
    notes: "<script>alert(1)</script>",
  }),
  env,
});
assert.equal(success.status, 200);
assert.match((await success.json()).message, /emailed successfully/i);
assert.equal(sentMessage.to, "abxh1920@gmail.com");
assert.equal(sentMessage.from, "pilot@impactgate.in");
assert.equal(sentMessage.replyTo, "applicant@example.com");
assert.match(sentMessage.text, /github\.com\/acme\/service/);
assert.match(sentMessage.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
assert.doesNotMatch(sentMessage.html, /<script>/);
assert.match(storedValue.key, /^waitlist:/);
assert.equal(JSON.parse(storedValue.value).email, "applicant@example.com");

sentMessage = undefined;
const honeypot = await onRequestPost({
  request: post({
    email: "spam@example.com",
    repository: "example",
    website: "filled by bot",
  }),
  env,
});
assert.equal(honeypot.status, 200);
assert.equal(sentMessage, undefined);

const invalid = await onRequestPost({
  request: post({ email: "not-an-email", repository: "repo" }),
  env,
});
assert.equal(invalid.status, 400);
assert.equal(sentMessage, undefined);

const unavailable = await onRequestPost({
  request: post({ email: "applicant@example.com", repository: "repo" }),
  env: {},
});
assert.equal(unavailable.status, 503);

const failed = await onRequestPost({
  request: post({ email: "applicant@example.com", repository: "repo" }),
  env: { EMAIL: { async send() { throw new Error("provider offline"); } } },
});
assert.equal(failed.status, 502);

console.log("Waitlist email API checks passed.");
