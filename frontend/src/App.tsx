import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./Layout";
import Dashboard from "./pages/Dashboard";
import AssetDetail from "./pages/AssetDetail";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="asset/:id" element={<AssetDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
