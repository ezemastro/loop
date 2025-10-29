import { View, Text } from "react-native";
import Mission from "./Mission";
import Listing from "./Listing";
import { DateBadge } from "../bases/DateBadge";
import CreditsBadge from "../badges/CreditsBadge";
import User from "./User";

export default function NotificationCard({
  notification,
}: {
  notification: AppNotification;
}) {
  const date = new Date(notification.createdAt);
  return (
    <View
      className={
        "bg-white rounded-lg " +
        (!notification.isRead
          ? "border border-main-text/50"
          : "border border-stroke")
      }
    >
      <NotificationContent notification={notification} />
      <DateBadge date={date} includeTime className="text-right py-1 px-3" />
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
    <View className="p-4 pb-2">
      <Text className="text-main-text text-xl">Haz completado una misión</Text>
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
    <View className="p-4 pb-2 gap-2">
      <Text className="text-main-text text-xl">{label}</Text>
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
    <View className="p-4 gap-2">
      <Text className="text-main-text text-xl">Nueva donación recibida</Text>
      <User user={payload.donorUser} className="border border-stroke" />
      <CreditsBadge
        credits={payload.amount}
        numberClassName="text-2xl"
        iconSize={32}
      />
    </View>
  );
}

function AdminNotification({ payload }: { payload: AdminNotificationPayload }) {
  switch (payload.action) {
    case "credits":
      return (
        <View className="p-4 pb-2 gap-2">
          <Text className="text-main-text text-xl">
            El equipo de Loop ha modificado tu cantidad de Loopies
          </Text>
          <Text className="text-main-text">
            {payload.amount && payload.amount > 0
              ? `Se han añadido ${payload.amount || 0} créditos a tu cuenta`
              : `Se han eliminado ${-(payload.amount || 0)} créditos de tu cuenta`}
          </Text>
        </View>
      );
    // TODO - Agregar otro tipo de notificaciones de admin
  }
}
