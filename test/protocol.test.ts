import { test, expect } from "bun:test";
import { sanitizeChatText, encode, decode, type ChatMessage } from "../src/protocol";

test("sanitizeChatText strips script tags and their content", () => {
  expect(sanitizeChatText("hi <script>alert(1)</script> there")).toBe("hi  there");
});

test("sanitizeChatText strips bare html tags but keeps text", () => {
  expect(sanitizeChatText("<b>bold</b> move")).toBe("bold move");
});

test("sanitizeChatText trims and clamps length", () => {
  expect(sanitizeChatText("   spaced   ")).toBe("spaced");
  expect(sanitizeChatText("x".repeat(20), 5)).toBe("xxxxx");
});

test("sanitizeChatText rejects non-strings", () => {
  expect(sanitizeChatText(42)).toBe("");
  expect(sanitizeChatText(null)).toBe("");
});

test("encode/decode round-trips a chat message", () => {
  const msg: ChatMessage = { id: "a", playerId: "p", name: "Happy Comet", text: "hello", timestamp: 123 };
  expect(decode<ChatMessage>(encode({ t: "chat", msg }) as string)).toEqual({ t: "chat", msg } as never);
});
