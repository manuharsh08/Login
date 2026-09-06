import { configKey, requestHash, safeEqual, sha256 } from "../src/integrity.js";

let fail = 0;
const check = (name, ok, detail = "") => {
  if (!ok) fail += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};

const sec = { kiosk: true, allowDevTools: false, allowedOrigins: ["https://exam.example.com"] };
const reordered = { allowedOrigins: ["https://exam.example.com"], allowDevTools: false, kiosk: true };
const relaxed = { ...sec, allowDevTools: true };

check("config key is stable", configKey(sec) === configKey(sec));
check("key ignores property order", configKey(sec) === configKey(reordered));
check("relaxing a restriction changes the key", configKey(sec) !== configKey(relaxed), "tamper-evident");

const KEY = configKey(sec);
const SECRET = "s3cret";
const url = "https://exam.example.com/exam/42";

check("request hash is deterministic", requestHash(url, KEY, SECRET) === requestHash(url, KEY, SECRET));
check(
  "hash is bound to the URL",
  requestHash(url, KEY, SECRET) !== requestHash("https://exam.example.com/exam/43", KEY, SECRET),
  "captured header cannot be replayed elsewhere"
);
check(
  "query string is ignored",
  requestHash(url + "?t=123", KEY, SECRET) === requestHash(url, KEY, SECRET),
  "cache busting must not break verification"
);
check("wrong secret fails", requestHash(url, KEY, "other") !== requestHash(url, KEY, SECRET));
check("relaxed config produces a different hash", requestHash(url, configKey(relaxed), SECRET) !== requestHash(url, KEY, SECRET));

check("safeEqual matches", safeEqual("abc", "abc"));
check("safeEqual rejects", !safeEqual("abc", "abd") && !safeEqual("abc", "ab") && !safeEqual(null, "abc"));
check("sha256 known vector", sha256("abc") === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");

console.log(fail ? `\n${fail} failing` : "\nattestation logic verified");
process.exit(fail ? 1 : 0);
