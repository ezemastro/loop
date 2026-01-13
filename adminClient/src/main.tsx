import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import Home from "@/pages/Home";
import { BrowserRouter, Route, Routes } from "react-router";
import Register from "@/pages/Register.tsx";
import Login from "@/pages/Login";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
