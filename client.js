const fetch = require("node-fetch");
const { performance } = require("perf_hooks");

const IP_A = process.env.IP_A; // e.g. http://34.xx.xx.xx:8080
const IP_B = process.env.IP_B;

if (!IP_A || !IP_B) {
  console.error("Usage: IP_A=http://...:8080 IP_B=http://...:8080 node client.js");
  process.exit(1);
}

async function postRegister(baseUrl, username) {
  const r = await fetch(`${baseUrl}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`register ${baseUrl} failed ${r.status}: ${text}`);
  return text;
}

async function getList(baseUrl) {
  const r = await fetch(`${baseUrl}/list`);
  const text = await r.text();
  if (!r.ok) throw new Error(`list ${baseUrl} failed ${r.status}: ${text}`);
  return JSON.parse(text);
}

async function timeIt(fn) {
  const t0 = performance.now();
  await fn();
  return performance.now() - t0;
}

async function avgLatency(baseUrl, label, n, fn) {
  const times = [];
  for (let i = 0; i < n; i++) times.push(await timeIt(fn));
  const avg = times.reduce((a, b) => a + b, 0) / n;
  console.log(`${label} @ ${baseUrl}: avg ${avg.toFixed(2)} ms`);
  return { avg, times };
}

async function partA() {
  const n = 10;

  const regA = await avgLatency(IP_A, "/register", n, async () => {
    await postRegister(IP_A, `latA_${Date.now()}_${Math.random()}`);
  });

  const regB = await avgLatency(IP_B, "/register", n, async () => {
    await postRegister(IP_B, `latB_${Date.now()}_${Math.random()}`);
  });

  const listA = await avgLatency(IP_A, "/list", n, async () => {
    await getList(IP_A);
  });

  const listB = await avgLatency(IP_B, "/list", n, async () => {
    await getList(IP_B);
  });

  return { regA, regB, listA, listB };
}

async function partB() {
  const iters = 100;
  let misses = 0;

  for (let i = 0; i < iters; i++) {
    const username = `ec_${Date.now()}_${i}_${Math.random().toString(16).slice(2)}`;

    await postRegister(IP_A, username);        // write in us-central1
    const data = await getList(IP_B);          // immediately read in europe-west1

    if (!(data.users || []).includes(username)) misses++;
  }

  console.log(`Eventual consistency: ${misses} misses out of ${iters}`);
  return { misses, iters };
}

(async () => {
  console.log("Part IV-A: Latency");
  const a = await partA();

  console.log("\nPart IV-B: Eventual consistency");
  const b = await partB();

  console.log("\nSummary (copy into Analysis.txt):");
  console.log(`A /register avg: ${a.regA.avg.toFixed(2)} ms`);
  console.log(`B /register avg: ${a.regB.avg.toFixed(2)} ms`);
  console.log(`A /list avg:     ${a.listA.avg.toFixed(2)} ms`);
  console.log(`B /list avg:     ${a.listB.avg.toFixed(2)} ms`);
  console.log(`Misses: ${b.misses} / ${b.iters}`);
})();
