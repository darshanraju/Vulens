import { describe, it, expect } from "vitest";
import { classifySentiment } from "./classify.js";

describe("sentiment classify", () => {
  it("returns bullish for moon/pump/buy", () => {
    expect(classifySentiment("SOL to the moon")).toBe("bullish");
    expect(classifySentiment("pump it")).toBe("bullish");
    expect(classifySentiment("buy the dip")).toBe("bullish");
  });
  it("returns bearish for dump/sell/crash", () => {
    expect(classifySentiment("going to dump")).toBe("bearish");
    expect(classifySentiment("sell everything")).toBe("bearish");
    expect(classifySentiment("market crash")).toBe("bearish");
  });
  it("returns neutral for empty or no keywords", () => {
    expect(classifySentiment("")).toBe("neutral");
    expect(classifySentiment("hello world")).toBe("neutral");
  });
  it("returns neutral when tie", () => {
    expect(classifySentiment("pump and dump")).toBe("neutral");
  });
  it("counts multiple matches", () => {
    expect(classifySentiment("moon pump bull buy")).toBe("bullish");
    expect(classifySentiment("dump crash rug")).toBe("bearish");
  });
});
