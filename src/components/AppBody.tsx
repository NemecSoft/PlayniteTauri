// Layout of the main app: sidebar + main content (library), with a bottom
// status bar.

import Sidebar from "./Sidebar";
import MainContent from "./MainContent";
import StatusBar from "./StatusBar";

export default function AppBody() {
  return (
    <div className="app-shell">
      <div className="app-body">
        <Sidebar />
        <MainContent />
      </div>
      <StatusBar />
    </div>
  );
}
