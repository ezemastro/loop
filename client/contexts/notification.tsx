import { createContext, useContext, useEffect, useRef, useState } from "react";
import * as Notification from "expo-notifications";
import { registerPushNotification } from "@/services/registerPushNotifications";
import { useRegisterPushToken } from "@/hooks/useRegisterToken";

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotification must be used within a NotificationsProvider",
    );
  }
  return context;
};

export const NotificationContext = createContext<
  NotificationContextType | undefined
>(undefined);

interface NotificationContextType {
  expoPushToken: string | null;
  notification: Notification.Notification | null;
  error: Error | null;
}

export const NotificationProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] =
    useState<Notification.Notification | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const { mutateAsync: savePushToken } = useRegisterPushToken();

  const notificationListener = useRef<Notification.EventSubscription | null>(
    null,
  );
  const responseListener = useRef<Notification.EventSubscription | null>(null);

  useEffect(() => {
    registerPushNotification()
      .then((token) => {
        setExpoPushToken(token);
        savePushToken({ notificationToken: token });
      })
      .catch((error) => setError(error));

    notificationListener.current = Notification.addNotificationReceivedListener(
      (notification) => {
        setNotification(notification);
      },
    );
    responseListener.current =
      Notification.addNotificationResponseReceivedListener((response) => {
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
  }, [savePushToken]);
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
