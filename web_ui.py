"""
YouTube Transcript Analyzer — Web UI
Runs using your Claude subscription via the `claude` CLI — no API key needed.
Run: python web_ui.py
Opens automatically at http://localhost:5000
"""
import json
import subprocess
import sys
import threading
import webbrowser

from flask import Flask, jsonify, render_template_string, request

from analysis import analyze_transcript, translate_to_english
from transcript import TranscriptError, clean_transcript, extract_video_id, fetch_transcript

app = Flask(__name__)

# ---------------------------------------------------------------------------
# HTML template (single-file, no external dependencies)
# ---------------------------------------------------------------------------

HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>YouTube Transcript Analyzer</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #0f1117;
    color: #e2e8f0;
    min-height: 100vh;
    padding: 2rem 1rem;
  }

  .container { max-width: 860px; margin: 0 auto; }

  h1 {
    font-size: 1.6rem;
    font-weight: 700;
    margin-bottom: 0.25rem;
    background: linear-gradient(90deg, #ff4e4e, #ff8c42);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .subtitle { color: #64748b; font-size: 0.9rem; margin-bottom: 2rem; }

  .card {
    background: #1e2130;
    border: 1px solid #2d3348;
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  label { display: block; font-size: 0.85rem; color: #94a3b8; margin-bottom: 0.4rem; }

  input[type="text"] {
    width: 100%;
    background: #0f1117;
    border: 1px solid #2d3348;
    border-radius: 8px;
    color: #e2e8f0;
    font-size: 0.95rem;
    padding: 0.65rem 0.9rem;
    outline: none;
    transition: border-color 0.2s;
  }
  input[type="text"]:focus { border-color: #ff4e4e; }

  .row { display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 1rem; align-items: flex-end; }
  .row .field { flex: 1; min-width: 120px; }

  .options { display: flex; gap: 1.5rem; margin-top: 1rem; flex-wrap: wrap; }
  .options label {
    display: flex; align-items: center; gap: 0.4rem;
    color: #94a3b8; font-size: 0.88rem; cursor: pointer;
    margin-bottom: 0;
  }
  input[type="checkbox"] { accent-color: #ff4e4e; width: 15px; height: 15px; }

  .btn {
    background: linear-gradient(135deg, #ff4e4e, #ff8c42);
    border: none;
    border-radius: 8px;
    color: #fff;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 600;
    padding: 0.7rem 2rem;
    width: 100%;
    margin-top: 1.2rem;
    transition: opacity 0.2s, transform 0.1s;
  }
  .btn:hover { opacity: 0.9; }
  .btn:active { transform: scale(0.98); }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .spinner {
    display: none;
    width: 18px; height: 18px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    margin: 0 auto;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .error-box {
    background: #2d1a1a;
    border: 1px solid #7f1d1d;
    border-radius: 8px;
    color: #fca5a5;
    font-size: 0.9rem;
    line-height: 1.5;
    padding: 0.8rem 1rem;
    margin-top: 1rem;
    display: none;
    white-space: pre-wrap;
  }

  #results { display: none; }

  .meta {
    display: flex; gap: 1rem; flex-wrap: wrap;
    font-size: 0.8rem; color: #64748b; margin-bottom: 1rem;
  }
  .meta span { background: #0f1117; border-radius: 4px; padding: 0.2rem 0.6rem; }

  .tabs { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
  .tab-btn {
    background: #0f1117; border: 1px solid #2d3348;
    border-radius: 6px; color: #94a3b8;
    cursor: pointer; font-size: 0.85rem;
    padding: 0.4rem 1rem;
    transition: all 0.2s;
  }
  .tab-btn.active { background: #ff4e4e; border-color: #ff4e4e; color: #fff; }

  .tab-panel { display: none; }
  .tab-panel.active { display: block; }

  .kp-list { list-style: none; }
  .kp-item {
    display: flex; gap: 0.75rem; align-items: flex-start;
    padding: 0.75rem 0;
    border-bottom: 1px solid #2d3348;
  }
  .kp-item:last-child { border-bottom: none; }
  .badge {
    flex-shrink: 0;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.15rem 0.5rem;
    text-transform: uppercase;
  }
  .badge.high   { background: #7f1d1d; color: #fca5a5; }
  .badge.medium { background: #78350f; color: #fcd34d; }
  .badge.low    { background: #1e3a5f; color: #93c5fd; }
  .kp-text { font-size: 0.95rem; line-height: 1.5; }

  .transcript-box {
    background: #0f1117;
    border: 1px solid #2d3348;
    border-radius: 8px;
    font-size: 0.88rem;
    line-height: 1.8;
    max-height: 500px;
    overflow-y: auto;
    padding: 1rem;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .copy-btn {
    background: #2d3348; border: none; border-radius: 6px;
    color: #94a3b8; cursor: pointer; font-size: 0.8rem;
    padding: 0.3rem 0.8rem; float: right; margin-bottom: 0.5rem;
    transition: background 0.2s;
  }
  .copy-btn:hover { background: #3d4458; color: #e2e8f0; }
</style>
</head>
<body>
<div class="container">
  <h1>YouTube Transcript Analyzer</h1>
  <p class="subtitle">Powered by your Claude subscription — no API key needed</p>

  <div class="card">
    <label>YouTube URL</label>
    <input type="text" id="url" placeholder="https://www.youtube.com/watch?v=..." autocomplete="off">

    <div class="row">
      <div class="field">
        <label>Language</label>
        <input type="text" id="language" value="en" style="max-width:90px">
      </div>
    </div>

    <div class="options">
      <label><input type="checkbox" id="timestamps"> Include timestamps</label>
      <label><input type="checkbox" id="no_transcript"> Key points only (skip transcript)</label>
      <label><input type="checkbox" id="translate"> Translate to English (e.g. Chinese videos)</label>
    </div>

    <button class="btn" id="analyzeBtn" onclick="analyze()">
      <span id="btnText">Analyze</span>
      <div class="spinner" id="spinner"></div>
    </button>

    <div class="error-box" id="errorBox"></div>
  </div>

  <div id="results">
    <div class="card">
      <div class="meta" id="meta"></div>

      <div class="tabs">
        <button class="tab-btn active" onclick="switchTab('keypoints', this)">Key Points</button>
        <button class="tab-btn" id="transcriptTabBtn" onclick="switchTab('transcript', this)">Full Transcript</button>
      </div>

      <div class="tab-panel active" id="tab-keypoints">
        <ul class="kp-list" id="kpList"></ul>
      </div>

      <div class="tab-panel" id="tab-transcript">
        <button class="copy-btn" onclick="copyTranscript()">Copy</button>
        <div class="transcript-box" id="transcriptBox"></div>
      </div>
    </div>
  </div>
</div>

<script>
async function analyze() {
  const url          = document.getElementById('url').value.trim();
  const language     = document.getElementById('language').value.trim() || 'en';
  const timestamps   = document.getElementById('timestamps').checked;
  const no_transcript = document.getElementById('no_transcript').checked;
  const translate    = document.getElementById('translate').checked;

  if (!url) { showError('Please enter a YouTube URL.'); return; }

  setLoading(true);
  hideError();
  document.getElementById('results').style.display = 'none';

  try {
    const resp = await fetch('/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, language, timestamps, no_transcript, translate })
    });
    const data = await resp.json();
    if (!resp.ok) { showError(data.error || 'An error occurred.'); return; }
    renderResults(data, no_transcript);
  } catch (e) {
    showError('Request failed: ' + e.message);
  } finally {
    setLoading(false);
  }
}

function renderResults(data, noTranscript) {
  document.getElementById('meta').innerHTML =
    `<span>Video: ${data.video_id}</span>` +
    `<span>Model: ${data.metadata.model}</span>` +
    `<span>Chunks: ${data.metadata.chunks_used}</span>` +
    (data.metadata.translated ? `<span>Translated to English</span>` : '');

  const list = document.getElementById('kpList');
  list.innerHTML = '';
  (data.key_points || []).forEach(kp => {
    const imp = (kp.importance || 'medium').toLowerCase();
    list.innerHTML += `<li class="kp-item">
      <span class="badge ${imp}">${imp}</span>
      <span class="kp-text">${escHtml(kp.point)}</span>
    </li>`;
  });

  const transcriptTab = document.getElementById('transcriptTabBtn');
  if (noTranscript || !data.transcript) {
    transcriptTab.style.display = 'none';
  } else {
    transcriptTab.style.display = '';
    document.getElementById('transcriptBox').textContent = data.transcript;
  }

  switchTab('keypoints', document.querySelector('.tab-btn'));
  document.getElementById('results').style.display = 'block';
}

function switchTab(name, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  btn.classList.add('active');
}

function copyTranscript() {
  navigator.clipboard.writeText(document.getElementById('transcriptBox').textContent);
}

function setLoading(on) {
  document.getElementById('analyzeBtn').disabled = on;
  document.getElementById('btnText').style.display = on ? 'none' : '';
  document.getElementById('spinner').style.display = on ? 'block' : 'none';
}

function showError(msg) { const b = document.getElementById('errorBox'); b.textContent = msg; b.style.display = 'block'; }
function hideError()    { document.getElementById('errorBox').style.display = 'none'; }
function escHtml(s)     { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !document.getElementById('analyzeBtn').disabled) analyze();
});
</script>
</body>
</html>
"""


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template_string(HTML)


@app.route("/analyze", methods=["POST"])
def analyze():
    body = request.get_json(force=True)
    url           = (body.get("url") or "").strip()
    language      = (body.get("language") or "en").strip()
    timestamps    = bool(body.get("timestamps", False))
    no_transcript = bool(body.get("no_transcript", False))
    translate     = bool(body.get("translate", False))

    if not url:
        return jsonify({"error": "URL is required."}), 400

    try:
        video_id = extract_video_id(url)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    try:
        raw = fetch_transcript(video_id, languages=[language])
        transcript = clean_transcript(raw, include_timestamps=timestamps)
    except TranscriptError as e:
        return jsonify({"error": str(e)}), 400

    try:
        if translate:
            transcript = translate_to_english(transcript)
        result = analyze_transcript(transcript)
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 502
    except Exception as e:
        return jsonify({"error": f"Unexpected error: {e}"}), 500

    output = {
        "video_id": video_id,
        "key_points": result["key_points"],
        "metadata": {
            "model": result["model_used"],
            "chunks_used": result["chunks_used"],
            "translated": translate,
        },
    }
    if not no_transcript:
        output["transcript"] = transcript

    return jsonify(output)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def find_free_port(start=5000, end=5100):
    import socket
    for port in range(start, end):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError(f"No free port found between {start} and {end}.")


def _open_url(url: str):
    """Open the URL in the default browser, using the most reliable method per OS."""
    try:
        if sys.platform == "darwin":
            # macOS: the `open` command is far more reliable than webbrowser.
            subprocess.run(["open", url], check=False)
        elif sys.platform.startswith("win"):
            subprocess.run(["cmd", "/c", "start", "", url], check=False, shell=False)
        else:
            webbrowser.open(url)
    except Exception:
        # Fall back to the cross-platform module; worst case the user opens it manually.
        webbrowser.open(url)


if __name__ == "__main__":
    port = find_free_port()

    def open_browser():
        import time
        time.sleep(1.5)
        _open_url(f"http://localhost:{port}")

    threading.Thread(target=open_browser, daemon=True).start()

    print(f"\n  YouTube Transcript Analyzer")
    print(f"  Powered by your Claude subscription (no API key needed)")
    print(f"  Open: http://localhost:{port}\n")
    app.run(host="0.0.0.0", port=port, debug=False)
