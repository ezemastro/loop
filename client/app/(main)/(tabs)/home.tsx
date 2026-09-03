import Home from "@/components/screens/Home";

// Escapes by reloading, not by replacing to `/home`: that would be a no-op while already on this
// tab (design.md D3).
export { AppErrorBoundary as ErrorBoundary } from "@/components/RouteErrorFallback";

export default function HomePage() {
  return <Home />;
}
