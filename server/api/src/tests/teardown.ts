export default async () => {
  if (global.__SERVER__) {
    await new Promise<void>((resolve, reject) => {
      global.__SERVER__.close((err: Error | null) => {
        if (err) {
          console.error("Error closing server:", err);
          reject(err);
        } else {
          console.log("Server closed successfully");
          resolve();
        }
      });
    });
  }
};
