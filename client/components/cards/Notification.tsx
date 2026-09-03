import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { twMerge } from "tailwind-merge";
import Mission from "./Mission";
import Listing from "./Listing";
import { DateBadge } from "../bases/DateBadge";
import CreditsBadge from "../badges/CreditsBadge";
import User from "./User";
import { notificationRoute } from "@/services/notificationRoute";

export default function NotificationCard({ notification }: { notification: AppNotification }) {
  const router = useRouter();
  const date = new Date(notification.createdAt);
  const isRead = notification.isRead;
  const destination = notificationRoute(notification);

  const content = (
    // Unread state used to be a 1px border-colour swap (easy to miss). It now reads through a
    // left accent bar + a soft tinted background instead, both of which recede to plain
    // white/stroke once read -- flat, no depth effects, so it renders identically on web and
    // native.
    <View
      className={twMerge(
        "flex-row overflow-hidden rounded-xl border bg-white",
        isRead ? "border-stroke" : "border-primary/30 bg-primary/5",
      )}
    >
      <View className={isRead ? "w-1 bg-stroke" : "w-1 bg-primary"} />
      <View className="flex-1">
        <NotificationContent notification={notification} isRead={isRead} />
        <DateBadge date={date} includeTime className="text-right py-1 px-3" />
      </View>
    </View>
  );

  // A card whose payload identifies no destination (a mission, or a malformed payload) MUST NOT
  // present a press affordance — there is nowhere for it to go.
  if (!destination) return content;

  return <Pressable onPress={() => router.push(destination)}>{content}</Pressable>;
}

function NotificationContent({
  notification,
  isRead,
}: {
  notification: AppNotification;
  isRead: boolean;
}) {
  switch (notification.type) {
    case "mission":
      return (
        <MissionNotification
          payload={notification.payload as MissionNotificationPayload}
          isRead={isRead}
        />
      );
    case "loop":
      return (
        <LoopNotification
          payload={notification.payload as LoopNotificationPayload}
          isRead={isRead}
        />
      );
    case "donation":
      return (
        <DonationNotification
          payload={notification.payload as DonationNotificationPayload}
          isRead={isRead}
        />
      );
    case "admin":
      return (
        <AdminNotification
          payload={notification.payload as AdminNotificationPayload}
          isRead={isRead}
        />
      );
    default:
      return null;
  }
}

/**
 * Every hydrated reference on a notification payload is best-effort: the server keeps the
 * notification and drops the reference when the row is gone (a deleted listing, a removed user).
 * The card MUST still render, because throwing here unmounts the whole route -- there is no error
 * boundary above it, so one dangling reference used to blank the entire app.
 */
const MissingReference = () => (
  <Text className="text-secondary-text text-sm">Este contenido ya no está disponible</Text>
);

/** Unread titles carry more weight than read ones; read titles recede back to normal weight. */
const titleClassName = (isRead: boolean) =>
  twMerge("text-main-text text-xl", !isRead && "font-bold");

function MissionNotification({
  payload,
  isRead,
}: {
  payload: MissionNotificationPayload;
  isRead: boolean;
}) {
  return (
    <View className="p-4 pb-2">
      <Text className={titleClassName(isRead)}>Has completado una misión</Text>
      {payload.userMission ? <Mission mission={payload.userMission} /> : <MissingReference />}
    </View>
  );
}
function LoopNotification({
  payload,
  isRead,
}: {
  payload: LoopNotificationPayload;
  isRead: boolean;
}) {
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
      label = "Has entregado correctamente esta publicación";
      break;
    case "listing_cancelled":
      label = "El loop con esta publicación ha sido cancelado";
      break;
  }
  return (
    <View className="p-4 pb-2 gap-2">
      <Text className={titleClassName(isRead)}>{label}</Text>
      {payload.listing ? (
        <Listing listing={payload.listing} variant="compact" />
      ) : (
        <MissingReference />
      )}
    </View>
  );
}

function DonationNotification({
  payload,
  isRead,
}: {
  payload: DonationNotificationPayload;
  isRead: boolean;
}) {
  return (
    <View className="p-4 gap-2">
      <Text className={titleClassName(isRead)}>Nueva donación recibida</Text>
      {payload.donorUser ? (
        <User user={payload.donorUser} className="border border-stroke" />
      ) : (
        <MissingReference />
      )}
      <CreditsBadge credits={payload.amount} numberClassName="text-2xl" iconSize={32} />
    </View>
  );
}

function AdminNotification({
  payload,
  isRead,
}: {
  payload: AdminNotificationPayload;
  isRead: boolean;
}) {
  switch (payload.action) {
    case "credits":
      return (
        <View className="p-4 pb-2 gap-2">
          <Text className={titleClassName(isRead)}>
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
    default:
      return null;
  }
}
