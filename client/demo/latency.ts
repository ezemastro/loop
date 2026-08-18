/** Retardo simulado para que los estados de carga se vean como contra la API real. */
const DEMO_LATENCY_MS = 250;

export const simulateLatency = () =>
  new Promise((resolve) => setTimeout(resolve, DEMO_LATENCY_MS * (0.6 + Math.random() * 0.8)));
