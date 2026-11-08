import { View, Text, Image, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { twMerge } from "tailwind-merge";
import { DateBadge } from "../bases/DateBadge";
import { CheckIcon, CreditIcon, RepeatIcon } from "../Icons";
import { listRowClassName, type RowPosition } from "../bases/listRow";
import { getListingImageSource, getProfileImageSource } from "@/services/getUrl";
import { formatNumber } from "@/utils/formatNumber";
import { notificationRoute } from "@/services/notificationRoute";

/**
 * One notification is one row of a list card: a 40px leading visual (thumbnail, avatar or icon),
 * a sentence naming the concrete thing, the time as a caption and, when unread, an 8px accent dot
 * with a semibold sentence. Read rows use regular weight and no dot.
 */
export default function NotificationCard({
  notification,
  position = "only",
}: {
  notification: AppNotification;
  position?: RowPosition;
}) {
  const router = useRouter();
  const date = new Date(notification.createdAt);
  const isRead = notification.isRead;
  const destination = notificationRoute(notification);
  const view = describeNotification(notification);

  const content = (
    <View className="flex-row items-start gap-3 px-4 py-3">
      <Leading visual={view.visual} />
      <View className="min-w-0 flex-1 gap-0.5">
        {view.sentence ? (
          <Text className={twMerge("text-base text-main-text", !isRead && "font-semibold")}>
            {view.sentence}
          </Text>
        ) : null}
        {view.missing ? <MissingReference /> : null}
        {view.detail ? <Text className="text-sm text-secondary-text">{view.detail}</Text> : null}
        <DateBadge date={date} includeTime className="text-xs" />
      </View>
      {isRead ? null : (
        <View accessibilityLabel="No leída" className="mt-2 h-2 w-2 rounded-full bg-accent" />
      )}
    </View>
  );

  // A card whose payload identifies no destination (a mission, or a malformed payload) MUST NOT
  // present a press affordance — there is nowhere for it to go.
  if (!destination) return <View className={listRowClassName(position)}>{content}</View>;

  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push(destination)}
      className={listRowClassName(position, "web:cursor-pointer hover:bg-background")}
    >
      {content}
    </Pressable>
  );
}

type Visual =
  | { kind: "listing"; url?: string }
  | { kind: "user"; url?: string }
  | { kind: "icon"; icon: "check" | "credits" | "repeat" }
  | null;

interface NotificationView {
  visual: Visual;
  sentence: string | null;
  detail?: string;
  /** The payload referenced a row that no longer exists. */
  missing?: boolean;
}

const LEADING_SIZE = 40;

function Leading({ visual }: { visual: Visual }) {
  if (visual?.kind === "listing") {
    return visual.url ? (
      <Image
        source={getListingImageSource(visual.url)}
        style={{ width: LEADING_SIZE, height: LEADING_SIZE }}
        className="rounded-lg bg-background"
        resizeMode="cover"
      />
    ) : (
      <View
        style={{ width: LEADING_SIZE, height: LEADING_SIZE }}
        className="rounded-lg bg-background"
      />
    );
  }
  if (visual?.kind === "user") {
    return (
      <Image
        source={getProfileImageSource(visual.url)}
        style={{ width: LEADING_SIZE, height: LEADING_SIZE }}
        className="rounded-full bg-background"
      />
    );
  }
  return (
    <View
      style={{ width: LEADING_SIZE, height: LEADING_SIZE }}
      className="items-center justify-center rounded-full border border-stroke bg-white"
    >
      {visual?.kind === "icon" && visual.icon === "check" ? (
        <CheckIcon size={20} className="text-accent" />
      ) : visual?.kind === "icon" && visual.icon === "credits" ? (
        <CreditIcon size={24} />
      ) : (
        <RepeatIcon size={20} className="text-accent" />
      )}
    </View>
  );
}

/** Sentence per loop event. `title` is the full listing title (it may wrap). */
const loopSentence = (type: LoopNotificationPayload["type"], title: string): string => {
  switch (type) {
    case "new_offer":
      return `Te ofrecieron un loop por ${title}`;
    case "offer_rejected":
      return `Rechazaron tu oferta de loop por ${title}`;
    case "offer_accepted":
      return `Aceptaron tu oferta de loop por ${title}`;
    case "offer_deleted":
      return `Retiraron una oferta de loop por ${title}`;
    case "listing_sold":
      return `Tu publicación ${title} fue vendida`;
    case "listing_received":
      return `Entregaste ${title}`;
    case "listing_cancelled":
      return `Se canceló el loop de ${title}`;
  }
};

/** Same events, without the listing: used when the referenced listing no longer exists. */
const loopGenericSentence = (type: LoopNotificationPayload["type"]): string => {
  switch (type) {
    case "new_offer":
      return "Te ofrecieron un loop";
    case "offer_rejected":
      return "Rechazaron tu oferta de loop";
    case "offer_accepted":
      return "Aceptaron tu oferta de loop";
    case "offer_deleted":
      return "Retiraron una oferta de loop";
    case "listing_sold":
      return "Tu publicación fue vendida";
    case "listing_received":
      return "Entregaste una publicación";
    case "listing_cancelled":
      return "Se canceló un loop";
  }
};

function describeNotification(notification: AppNotification): NotificationView {
  switch (notification.type) {
    case "mission": {
      const payload = notification.payload as MissionNotificationPayload;
      const title = payload.userMission?.missionTemplate.title;
      return {
        visual: { kind: "icon", icon: "check" },
        sentence: title ? `Completaste la misión ${title}` : "Completaste una misión",
        missing: !payload.userMission,
      };
    }
    case "loop": {
      const payload = notification.payload as LoopNotificationPayload;
      const listing = payload.listing;
      return {
        visual: listing
          ? { kind: "listing", url: listing.media?.[0]?.url }
          : { kind: "icon", icon: "repeat" },
        sentence: listing
          ? loopSentence(payload.type, listing.title)
          : loopGenericSentence(payload.type),
        missing: !listing,
      };
    }
    case "donation": {
      const payload = notification.payload as DonationNotificationPayload;
      const donor = payload.donorUser;
      const amount = `${formatNumber(payload.amount)} loopies`;
      return {
        visual: donor
          ? { kind: "user", url: donor.profileMedia?.url }
          : { kind: "icon", icon: "credits" },
        sentence: donor
          ? `${donor.firstName} ${donor.lastName} te donó ${amount}`
          : `Recibiste una donación de ${amount}`,
        missing: !donor,
      };
    }
    case "admin": {
      const payload = notification.payload as AdminNotificationPayload;
      if (payload.action !== "credits") return { visual: null, sentence: null };
      const amount = payload.amount ?? 0;
      return {
        visual: { kind: "icon", icon: "credits" },
        sentence: "El equipo de Loop modificó tu cantidad de loopies",
        detail:
          amount > 0
            ? `Se añadieron ${formatNumber(amount)} loopies a tu cuenta`
            : `Se quitaron ${formatNumber(-amount)} loopies de tu cuenta`,
      };
    }
    default:
      return { visual: null, sentence: null };
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
