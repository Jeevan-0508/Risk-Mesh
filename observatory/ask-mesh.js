import goldenCases from "./data/golden-cases.js";
import system1Cases from "./data/system1-cases.js";
import repoRegistry from "./data/repo-registry.js";

// --- Ask MESH: a bring-your-own-key Q&A panel grounded ONLY in the same replay fixture data ---
// --- orb.js already replays in the terminal log above. No live connection, no fabrication. ---

const KEYS_STORAGE_KEY = "risk-mesh:ask-mesh-keys";
const PREFS_STORAGE_KEY = "risk-mesh:ask-mesh-prefs";

const PROVIDER_ENDPOINT = {
  openai: "https://api.openai.com/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
};
const DEFAULT_MODEL = {
  openai: "gpt-4o-mini",
  openrouter: "openai/gpt-4o-mini",
};

// Guarded localStorage, same discipline as risk-swarm app/lib/models.ts: a full or hostile
// storage degrades to doing nothing, never to crashing the panel.
function restoreKeys() {
  try {
    const raw = window.localStorage.getItem(KEYS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const out = {};
    for (const p of Object.keys(PROVIDER_ENDPOINT)) {
      if (typeof parsed[p] === "string" && parsed[p]) out[p] = parsed[p];
    }
    return out;
  } catch {
    return {};
  }
}
function persistKey(provider, key) {
  try {
    const keys = restoreKeys();
    keys[provider] = key;
    window.localStorage.setItem(KEYS_STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // a key that cannot be saved is a convenience lost, not a reason to fail the panel
  }
}
function clearKey(provider) {
  try {
    const keys = restoreKeys();
    delete keys[provider];
    window.localStorage.setItem(KEYS_STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // nothing to do
  }
}
function restorePrefs() {
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return {
      provider: typeof parsed.provider === "string" ? parsed.provider : undefined,
      model: typeof parsed.model === "string" ? parsed.model : undefined,
    };
  } catch {
    return {};
  }
}
function persistPrefs(prefs) {
  try {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // preference persistence is a convenience, never a blocker
  }
}

// The Fraud Watch simulator's answer key for a System-1 case -- deliberately never shown to
// Laya during the blind replay. It describes only the generated simulation world, not an actual
// carrier, incident, investigation, or externally verified event.
function groundTruthLines(gt) {
  const lines = [];
  lines.push(
    "- SIMULATION GROUND TRUTH (Fraud Watch answer key; synthetic and not a real-world investigation): status=" +
      gt.status + ", classification=" + gt.classification + ", confidence=" + gt.confidence +
      " (" + gt.confidenceBand + "), noveltyScore=" + gt.noveltyScore + ".",
  );
  lines.push("  signature: " + gt.signature + ".");
  const entityParts = [];
  for (const k of Object.keys(gt.entities)) {
    if (gt.entities[k]) entityParts.push(k + "=" + gt.entities[k]);
  }
  lines.push("  entities: " + (entityParts.length > 0 ? entityParts.join(", ") : "none recorded") + ".");
  lines.push(
    "  timeline: " + gt.timeline.map((e) => e.type + "@t=" + e.t).join(" -> ") + ".",
  );
  lines.push(
    "  evidence: " +
      gt.evidence
        .map((e) => e.signalType + " (contribution=" + e.contribution + ", reliability=" + e.reliability + ")")
        .join("; ") +
      ".",
  );
  return lines;
}

// The complete, fixed replay-fixture data this same page displays above -- nothing else is
// ever fed to the model. If a question needs something outside this block, the system prompt
// tells the model to say so rather than guess.
export function buildMeshContext(cases) {
  const lines = [];
  for (const c of cases) {
    lines.push("### " + c.title + " (case_id=" + c.case_id + ")");
    lines.push("- data_class: simulation_test_fixture (synthetic/demo data; not real-world incident evidence)");
    lines.push(c.summary);
    for (const ev of c.events) {
      lines.push("- [" + ev.at + "] " + ev.type + ": " + ev.detail);
    }
    if (c.blocked_attempt) {
      lines.push("- BLOCKED " + c.blocked_attempt.from + " -> " + c.blocked_attempt.to + ": " + c.blocked_attempt.message);
    }
    if (c.ground_truth) {
      lines.push(...groundTruthLines(c.ground_truth));
    }
    lines.push("");
  }
  return lines.join("\n");
}

function buildRegistryContext(repos) {
  const lines = [];
  for (const r of repos) {
    lines.push('- ' + r.name + ' (' + r.domain + '): status=' + r.status + ', source=' + r.source_type + '.');
    if (r.capabilities && r.capabilities.length > 0) {
      lines.push('  Can answer: ' + r.capabilities.join('; ') + '.');
    } else {
      lines.push('  No MESH adapter reads this repository yet -- do not claim any connection to it.');
    }
  }
  return lines.join(String.fromCharCode(10));
}

export function buildSystemPrompt(context, registryContext) {
  return [
    "You are answering visitor questions on the RISK//MESH Observatory page, a small demo site for a personal project by Jeevan Siddhabhaktula. Answer ONLY from the CASE DATA and REPOSITORY REGISTRY below. The CASE DATA is a fixed replay fixture: two golden test cases and two Fraud Watch simulator cases. Its simulation answer keys are synthetic and are not real incident or investigation evidence. The REPOSITORY REGISTRY records the connection status represented by this page. If a question cannot be answered from this data, say 'I don't know' or 'evidence is insufficient' instead of guessing.",
    "",
    "Be accurate about what RISK//MESH actually is: a connective contract, evidence and provenance layer over several independent risk projects, not a live, always-on feed across all of them. Use the REPOSITORY REGISTRY below as the source for the connection status represented here (LIVE, SNAPSHOT, or FIXTURE versus UNAVAILABLE); never claim a live connection to an UNAVAILABLE repository. This page is a replay of a past test run, not a live system. DEC-001 is a seeded demo decision, and every Fraud Watch ground-truth label in this fixture describes only the simulator's generated world. Never present those labels as real-world facts or extrapolate them to actual carriers, incidents, prevalence, or fraud patterns.",
    "",
    "For each Fraud Watch System-1 simulator case, the CASE DATA has two layers: (1) BEHAVIOR_OBSERVED/MODEL_CALLED/ARENA_COMPARED/SYSTEM1_ROUTED events describe what Laya received during this blind replay, and (2) SIMULATION GROUND TRUTH is the simulator's generated answer key, never shown to Laya. Both layers are synthetic test data. When asked what a case actually was, say only what the simulation generated; explicitly state that this does not establish what happened in the real world. Treat Laya's classification, confidence band, and novelty score as model outputs, not verified facts.",
    "",
    "REPOSITORY REGISTRY:",
    registryContext,
    "",
    "CASE DATA:",
    context,
  ].join(String.fromCharCode(10));
}

async function askProvider(opts) {
  const provider = opts.provider, key = opts.key, model = opts.model, question = opts.question, context = opts.context, registryContext = opts.registryContext;
  const endpoint = PROVIDER_ENDPOINT[provider];
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + key },
    body: JSON.stringify({
      model: model || DEFAULT_MODEL[provider],
      temperature: 0,
      max_tokens: 500,
      messages: [
        { role: "system", content: buildSystemPrompt(context, registryContext) },
        { role: "user", content: question },
      ],
    }),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body && body.error && body.error.message ? body.error.message : ("HTTP " + res.status);
    throw new Error(provider + " error: " + msg);
  }
  if (body && body.error) {
    throw new Error(provider + " error: " + (body.error.message || "unknown error"));
  }
  const text = body && body.choices && body.choices[0] && body.choices[0].message
    ? body.choices[0].message.content
    : null;
  if (!text || !text.trim()) throw new Error(provider + " returned no content");
  return text.trim();
}

function wire() {
  const toggleBtn = document.getElementById("ask-toggle");
  const panel = document.getElementById("ask-panel");
  const providerSel = document.getElementById("ask-provider");
  const keyInput = document.getElementById("ask-key");
  const modelInput = document.getElementById("ask-model");
  const clearBtn = document.getElementById("ask-clear-key");
  const questionInput = document.getElementById("ask-question");
  const submitBtn = document.getElementById("ask-submit");
  const responseEl = document.getElementById("ask-response");
  if (!toggleBtn || !panel) return; // ask-mesh.js loaded without its DOM -- do nothing, never throw

  const allCases = [...goldenCases.cases, ...system1Cases.cases];
  const context = buildMeshContext(allCases);
  const registryContext = buildRegistryContext(repoRegistry.repositories);

  const prefs = restorePrefs();
  if (prefs.provider) providerSel.value = prefs.provider;
  if (prefs.model) modelInput.value = prefs.model;
  const loadKeyForProvider = () => {
    const keys = restoreKeys();
    keyInput.value = keys[providerSel.value] || "";
  };
  loadKeyForProvider();

  toggleBtn.addEventListener("click", () => {
    const open = panel.hidden;
    panel.hidden = !open;
    toggleBtn.setAttribute("aria-expanded", String(open));
  });

  providerSel.addEventListener("change", () => {
    loadKeyForProvider();
    persistPrefs({ provider: providerSel.value, model: modelInput.value });
  });
  modelInput.addEventListener("change", () => {
    persistPrefs({ provider: providerSel.value, model: modelInput.value });
  });
  keyInput.addEventListener("change", () => {
    persistKey(providerSel.value, keyInput.value.trim());
  });
  clearBtn.addEventListener("click", () => {
    clearKey(providerSel.value);
    keyInput.value = "";
  });

  async function submit() {
    const question = questionInput.value.trim();
    const key = keyInput.value.trim();
    if (!question) return;
    if (!key) {
      responseEl.className = "ask-response error";
      responseEl.textContent = "Paste an API key above first -- it is used directly from your browser, never sent to this site.";
      return;
    }
    submitBtn.disabled = true;
    responseEl.className = "ask-response loading";
    responseEl.textContent = "Asking...";
    try {
      const answer = await askProvider({
        provider: providerSel.value,
        key: key,
        model: modelInput.value.trim(),
        question: question,
        context: context,
        registryContext: registryContext,
      });
      responseEl.className = "ask-response";
      responseEl.textContent = answer;
    } catch (err) {
      responseEl.className = "ask-response error";
      responseEl.textContent = err instanceof Error ? err.message : "something went wrong";
    } finally {
      submitBtn.disabled = false;
    }
  }

  submitBtn.addEventListener("click", submit);
  questionInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submit();
  });
}

if (typeof document !== "undefined") wire();
