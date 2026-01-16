import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import Home from "@/pages/Home";
import { BrowserRouter, Route, Routes } from "react-router";
import Register from "@/pages/Register.tsx";
import Login from "@/pages/Login";
import Schools from "@/pages/Schools";
import Users from "@/pages/Users";
import Categories from "@/pages/Categories";
import Missions from "@/pages/Missions";
import Notifications from "@/pages/Notifications";
import AuthorizeAdmin from "@/pages/AuthorizeAdmin";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { GOOGLE_CLIENT_ID } from "@/config";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <BrowserRouter>
        <Routes>
          <Route path="/schools" element={<Schools />} />
          <Route path="/users" element={<Users />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/missions" element={<Missions />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/authorize-admin" element={<AuthorizeAdmin />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </GoogleOAuthProvider>
  </StrictMode>,
);
