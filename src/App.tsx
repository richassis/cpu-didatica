import { Navigate, Route, Routes } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import HomePage from "@/app/page";
import ConfigPage from "@/app/config/page";

export default function App() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-950">
      <Sidebar />
      <main className="flex flex-col flex-1 min-h-0 min-w-0">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
