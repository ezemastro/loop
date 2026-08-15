import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import { BrowserRouter, Route, Routes } from "react-router";
import Register from "@/pages/Register.tsx";
import Login from "@/pages/Login";
import Schools from "@/pages/Schools";
import Users from "@/pages/Users";
import Categories from "@/pages/Categories";
import Missions from "@/pages/Missions";
import Notifications from "@/pages/Notifications";
import AuthorizeAdmin from "@/pages/AuthorizeAdmin";
import Communities from "@/pages/Communities";
import Invitations from "@/pages/Invitations";
import DeletionRequests from "@/pages/DeletionRequests";
import RequireSuperAdmin from "@/components/RequireSuperAdmin";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { GOOGLE_CLIENT_ID } from "@/config";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <BrowserRouter>
        <Routes>
          <Route path="/schools" element={<Schools />} />
          <Route path="/users" element={<Users />} />
          <Route path="/invitations" element={<Invitations />} />
          <Route path="/deletion-requests" element={<DeletionRequests />} />
          {/*
            Categorías y misiones son catálogos COMPARTIDOS entre todas las comunidades: si los
            editara un admin de comunidad, estaría cambiando los precios y las recompensas de
            todas. Por eso, igual que comunidades, quedan reservadas al super admin.
          */}
          <Route
            path="/communities"
            element={
              <RequireSuperAdmin>
                <Communities />
              </RequireSuperAdmin>
            }
          />
          <Route
            path="/categories"
            element={
              <RequireSuperAdmin>
                <Categories />
              </RequireSuperAdmin>
            }
          />
          <Route
            path="/missions"
            element={
              <RequireSuperAdmin>
                <Missions />
              </RequireSuperAdmin>
            }
          />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/authorize-admin" element={<AuthorizeAdmin />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </GoogleOAuthProvider>
  </StrictMode>,
);
