
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  if (new URLSearchParams(location.search).has("pop-settings")) {
    location.replace("/pop-settings.html");
  } else {
    createRoot(document.getElementById("root")!).render(<App />);
  }
  
