import { useState, useEffect } from "react";
import "./App.css";

export default function App() {
  const [form, setForm] = useState({
    recipient_name: "", your_name: "", relationship: "", memories: "", tone: "warm and heartfelt"
  });
  const [file, setFile] = useState(null);
  const [letter, setLetter] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedLetters, setSavedLetters] = useState([]);
  const [showGallery, setShowGallery] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const fetchLetters = async () => {
    const res = await fetch("http://localhost:8000/letters");
    const data = await res.json();
    setSavedLetters(data);
  };

  useEffect(() => { fetchLetters(); }, []);

  const handleSubmit = async () => {
    setLoading(true);
    setLetter("");
    setSaved(false);
    const data = new FormData();
    Object.entries(form).forEach(([k, v]) => data.append(k, v));
    if (file) data.append("file", file);

    const res = await fetch("http://localhost:8000/generate", { method: "POST", body: data });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      setLetter(prev => prev + decoder.decode(value));
    }
    setLoading(false);
  };

  const handleSave = async () => {
    const data = new FormData();
    data.append("recipient_name", form.recipient_name);
    data.append("your_name", form.your_name);
    data.append("letter", letter);
    await fetch("http://localhost:8000/save", { method: "POST", body: data });
    setSaved(true);
    fetchLetters();
  };

  return (
    <div className="app">
      <h1>💌 Gratitude Letter Generator</h1>
      <p className="subtitle">Turn your memories into a letter they'll keep forever.</p>

      <div className="form">
        <input placeholder="Your name" value={form.your_name}
          onChange={e => setForm({...form, your_name: e.target.value})} />
        <input placeholder="Recipient's name" value={form.recipient_name}
          onChange={e => setForm({...form, recipient_name: e.target.value})} />
        <input placeholder="Your relationship (e.g. my mom, my mentor)" value={form.relationship}
          onChange={e => setForm({...form, relationship: e.target.value})} />
        <textarea placeholder="Share your memories and why you're grateful for them..."
          rows={5} value={form.memories}
          onChange={e => setForm({...form, memories: e.target.value})} />
        <select value={form.tone} onChange={e => setForm({...form, tone: e.target.value})}>
          <option>warm and heartfelt</option>
          <option>playful and light</option>
          <option>formal and respectful</option>
          <option>emotional and vulnerable</option>
        </select>
        <label className="file-label">
          📎 Attach a photo or memory (optional)
          <input type="file" onChange={e => setFile(e.target.files[0])} />
        </label>
        {file && <p className="file-name">✅ {file.name}</p>}
        <button onClick={handleSubmit} disabled={loading}>
          {loading ? "Writing your letter..." : "✨ Generate Letter"}
        </button>
      </div>

      {letter && (
        <div className="letter">
          <h2>Your Letter</h2>
          <p>{letter}</p>
          <div className="letter-actions">
            <button onClick={() => navigator.clipboard.writeText(letter)}>📋 Copy</button>
            <button onClick={handleSave} disabled={saved} className="save-btn">
              {saved ? "✅ Saved!" : "💾 Save Letter"}
            </button>
          </div>
        </div>
      )}

      {savedLetters.length > 0 && (
        <div className="gallery-section">
          <button className="gallery-toggle" onClick={() => setShowGallery(!showGallery)}>
            📬 Saved Letters ({savedLetters.length}) {showGallery ? "▲" : "▼"}
          </button>
          {showGallery && (
            <div className="gallery">
              {savedLetters.map((l, i) => (
                <div key={i} className="gallery-card" onClick={() => setExpanded(expanded === i ? null : i)}>
                  <div className="gallery-card-header">
                    <span>💌 To {l.recipient_name} from {l.your_name}</span>
                    <span className="gallery-date">{new Date(l.saved_at).toLocaleDateString()}</span>
                  </div>
                  {expanded === i && <p className="gallery-letter">{l.letter}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}