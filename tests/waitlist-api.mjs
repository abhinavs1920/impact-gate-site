import assert from "node:assert/strict";
import { build } from "esbuild";

const res = await build({
  entryPoints: [new URL("../src/functions/api/waitlist.ts", import.meta.url).pathname],
  bundle: true,
  write: false,
  format: "esm",
  target: "es2022",
});
const code = res.outputFiles[0].text;
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
const storedValues = new Map();
const env = {
  EMAIL: {
    async send(message) {
      sentMessage = message;
      return { messageId: "test-message-id" };
    },
  },
  WAITLIST: {
    async put(key, value) {
      storedValues.set(key, value);
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
const waitlistEntry = [...storedValues.entries()].find(([k]) => /^waitlist:/.test(k));
assert.ok(waitlistEntry, "Expected a key starting with waitlist:");
assert.equal(JSON.parse(waitlistEntry[1]).email, "applicant@example.com");

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
