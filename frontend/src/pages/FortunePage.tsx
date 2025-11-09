import { useState } from "react";
import { Link } from "react-router-dom";
import "../App.css";

export default function FortunePage() {
  const [name, setName] = useState("");
  const [fortune, setFortune] = useState("");
  
  const getFortune = async () => {
    if (!name) return alert("Please enter your name!");
    setFortune("Loading your fortune... 🔮");
    try {
      const res = await fetch(`/fortune?name=${encodeURIComponent(name)}`);
      const data = await res.json();
      setFortune(data.message);
    } catch {
      setFortune("Something went wrong 😔");
    }
  };

  return (
    <div className="app-background">
      <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
        <h1>Your fortune awaits 🔮</h1>
        <input
          type="text"
          placeholder="Enter your name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ padding: "10px", fontSize: "16px" }}
        />
        <button
          onClick={getFortune}
          style={{
            marginLeft: "10px",
            padding: "10px 20px",
            fontSize: "16px",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          Reveal my fortune
        </button>

        {fortune && <p style={{ marginTop: 30, fontSize: 20 }}>✨ {fortune}</p>}

        <p style={{ marginTop: 40 }}>
          <Link to="/">Back to home ⬅</Link>
        </p>
      </div>
    </div>
  );
}
