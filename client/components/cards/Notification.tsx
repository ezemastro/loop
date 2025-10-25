import { View, Text } from "react-native";
import Mission from "./Mission";
import Listing from "./Listing";

export default function NotificationCard({
  notification,
}: {
  notification: AppNotification;
}) {
  return (
    <View
      className={
        "bg-white rounded " + !notification.isRead
          ? "border border-main-text/50"
          : ""
      }
    >
      <NotificationContent notification={notification} />
    </View>
  );
}

function NotificationContent({
  notification,
}: {
  notification: AppNotification;
}) {
  switch (notification.type) {
    case "mission":
      return (
        <MissionNotification
          payload={notification.payload as MissionNotificationPayload}
        />
      );
    case "loop":
      return (
        <LoopNotification
          payload={notification.payload as LoopNotificationPayload}
        />
      );
    case "donation":
      return (
        <DonationNotification
          payload={notification.payload as DonationNotificationPayload}
        />
      );
    case "admin":
      return (
        <AdminNotification
          payload={notification.payload as AdminNotificationPayload}
        />
      );
  }
}

function MissionNotification({
  payload,
}: {
  payload: MissionNotificationPayload;
}) {
  return (
    <View className="p-4">
      <Text className="font-bold">Haz completado una misión</Text>
      <Mission mission={payload.userMission} />
    </View>
  );
}
function LoopNotification({ payload }: { payload: LoopNotificationPayload }) {
  let label;
  switch (payload.type) {
    case "new_offer":
      label = "Alguien te ha ofrecido un Loop";
      break;
    case "offer_rejected":
      label = "Tu oferta de Loop ha sido rechazada";
      break;
    case "offer_accepted":
      label = "Tu oferta de Loop ha sido aceptada";
      break;
    case "offer_deleted":
      label = "Una oferta de Loop ha sido eliminada";
      break;
    case "listing_sold":
      label = "Tu publicación ha sido vendida";
      break;
    case "listing_received":
      label = "Haz entregado correctamente esta publicación";
      break;
    case "listing_cancelled":
      label = "El loop con esta publicación ha sido cancelado";
      break;
  }
  return (
    <View className="p-4">
      <Text className="font-bold">{label}</Text>
      <Listing listing={payload.listing} />
    </View>
  );
}

function DonationNotification({
  payload,
}: {
  payload: DonationNotificationPayload;
}) {
  return (
    <View className="p-4">
      <Text className="font-bold">Nueva donación recibida</Text>
      <Text>{payload.amount || 0}</Text>
    </View>
  );
}

function AdminNotification({ payload }: { payload: AdminNotificationPayload }) {
  switch (payload.action) {
    case "credits":
      return (
        <View className="p-4 gap-2">
          <Text className="text-main-text text-lg font-bold">
            El equipo de Loop ha modificado tu cantidad de Loopies
          </Text>
          <Text className="text-main-text">
            {payload.amount && payload.amount > 0
              ? `Se han añadido ${payload.amount || 0} créditos a tu cuenta`
              : `Se han eliminado ${-(payload.amount || 0)} créditos de tu cuenta`}
          </Text>
        </View>
      );
  }
}
