import { createContext, useContext, useEffect, useRef, useState } from "react";
import * as Notification from "expo-notifications";
import { registerPushNotification } from "@/services/registerPushNotifications";
import { useRegisterPushToken } from "@/hooks/useRegisterToken";
import { useSessionStore } from "@/stores/session";

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within a NotificationsProvider");
  }
  return context;
};

export const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationContextType {
  expoPushToken: string | null;
  notification: Notification.Notification | null;
  error: Error | null;
}

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const authToken = useSessionStore((state) => state.authToken);
  const isLoggedIn = useSessionStore((state) => !!state.user);
  const demoMode = useSessionStore((state) => state.demoMode);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notification.Notification | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const { mutateAsync: savePushToken } = useRegisterPushToken();

  const notificationListener = useRef<Notification.EventSubscription | null>(null);
  const responseListener = useRef<Notification.EventSubscription | null>(null);

  useEffect(() => {
    if (!isLoggedIn || !authToken) {
      return;
    }
    // En la demo no se registran notificaciones. El `POST` al backend ya lo intercepta el mock,
    // pero pedir el token igual saldría a los servidores de Expo y, en el celular, le pediría al
    // visitante permiso de notificaciones para una sesión que no es suya. Nada de eso corresponde.
    if (demoMode) {
      return;
    }

    registerPushNotification()
      .then(async (token) => {
        setExpoPushToken(token);
        try {
          await savePushToken({ notificationToken: token });
        } catch (err) {
          console.error("Error saving push token:", err);
        }
      })
      .catch((error) => setError(error));

    notificationListener.current = Notification.addNotificationReceivedListener((notification) => {
      setNotification(notification);
    });
    responseListener.current = Notification.addNotificationResponseReceivedListener((response) => {
      console.log(response);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [savePushToken, isLoggedIn, authToken, demoMode]);
  return (
    <NotificationContext.Provider
      value={{
        expoPushToken,
        notification,
        error,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
