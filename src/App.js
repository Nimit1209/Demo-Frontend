import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import ProjectEditor from "./pages/ProjectEditor"; // Import the new page

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/projecteditor/:projectId" element={<ProjectEditor />} /> {/* New route */}
      </Routes>
    </Router>
  );
}

export default App;
