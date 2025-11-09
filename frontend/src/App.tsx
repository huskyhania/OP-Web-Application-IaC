import "./App.css";
import { Link } from "react-router-dom";

function App() {
  const openPhoto = async () => {
    try {
      const res = await fetch(`/photo`);
      const data = await res.json();
      window.open(data.url, "_blank");
    } catch {
      alert("Could not load photo 😢");
    }
  };

  return (
    <div className="app-background">
      <div style={{ textAlign: "center", width: "90%", maxWidth: "900px", margin: "0 auto" }}>
        <h1>Welcome, traveler!</h1>
        <p style={{ fontSize: "18px" }}>
          I’m <b>Hanna</b> — developer, dreamer, and cloud enthusiast.<br />
          Thanks for visiting my site!
        </p>

        <div style={{ marginTop: 20 }}>
          <a href="https://github.com/huskyhania" target="_blank" rel="noopener noreferrer" style={{ margin: "0 10px" }}>GitHub</a>
          <a href="https://www.linkedin.com/in/hanna-ewa-skrzypiec/" target="_blank" rel="noopener noreferrer" style={{ margin: "0 10px" }}>LinkedIn</a>
          <a href="mailto:h.skrzypiec@gmail.com" style={{ margin: "0 10px" }}>Email</a>
        </div>

        <div style={{ marginTop: 40 }}>
          <button
            onClick={openPhoto}
            style={{ padding: "10px 20px", fontSize: "16px", borderRadius: "8px", marginRight: "10px", cursor: "pointer" }}
          >
            See author's photo 📷 🐶
          </button>

          <Link to="/fortune">
            <button
              style={{ padding: "10px 20px", fontSize: "16px", borderRadius: "8px", cursor: "pointer" }}
            >
              Get to know your fortune 🔮
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default App;