import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import Home from "@/pages/Home";
import { BrowserRouter, Route, Routes } from "react-router";
import Register from "@/pages/Register.tsx";
import Login from "@/pages/Login";
import Schools from "@/pages/Schools";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/schools" element={<Schools />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
