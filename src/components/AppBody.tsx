// Layout of the main app: sidebar + main content (library).

import Sidebar from "./Sidebar";
import MainContent from "./MainContent";

export default function AppBody() {
  return (
    <div className="app-body">
      <Sidebar />
      <MainContent />
    </div>
  );
}
