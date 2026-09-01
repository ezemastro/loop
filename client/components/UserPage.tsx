import { View, Text, FlatList, Pressable } from "react-native";
import React, { useState } from "react";
import { twMerge } from "tailwind-merge";
import { useRouter } from "expo-router";
import { MainView, pageContentClassName } from "./bases/MainView";
import AvoidingKeyboard from "./AvoidingKeyboard";
import BackButton from "./BackButton";
import ProfileImage from "./ProfileImage";
import { CreditIcon, EmailIcon, SettingsIcon } from "./Icons";
import { formatNumber } from "@/utils/formatNumber";
import CustomButton from "./bases/CustomButton";
import ButtonText from "./bases/ButtonText";
import CustomRefresh from "./CustomRefresh";
import MyPendingList from "./MyPendingList";
import DonateModal from "./modals/DonateModal";
import Stats from "./Stats";
import { usePublicWishes } from "@/hooks/usePublicWishes";
import CategoryBadge from "./CategoryBadge";
import ReportButton from "./ReportButton";

interface Section {
  key: string;
  title?: string;
  component: () => React.ReactNode;
  show?: boolean;
  hide?: boolean;
  /**
   * Alignment applied to both the title and the body as one block, so a section never shows a
   * left-hanging label over centred content. Defaults to "left" (the existing look for every
   * section except "credits", whose body is already centred).
   */
  align?: "left" | "center";
}
export default function UserPage({
  user,
  isCurrentUser,
  canGoBack = false,
}: {
  user: PublicUser | PrivateUser;
  isCurrentUser: boolean;
  canGoBack?: boolean;
}) {
  const { data: wishesData } = usePublicWishes({ userId: user.id });
  const wishes = wishesData?.userWishes || [];
  const sectionsContentClassName = pageContentClassName("narrow", "p-4 gap-6");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState<{
    "to-receive": number;
    "to-deliver": number;
    "to-accept": number;
    "waiting-acceptance": number;
  }>({
    "to-receive": 0,
    "to-deliver": 0,
    "to-accept": 0,
    "waiting-acceptance": 0,
  });
  const sections: Section[] = [
    {
      key: "header",
      component: () => (
        <View className="flex-row items-center justify-between">
          <View>{canGoBack && <BackButton />}</View>
          {!isCurrentUser && (
            <ReportButton user={user} className="px-3 py-2 rounded-full" label="Denunciar" />
          )}
          {isCurrentUser && (
            <Pressable className="p-1" hitSlop={10} onPress={() => router.push("/(main)/settings")}>
              <SettingsIcon className="text-main-text" size={26} />
            </Pressable>
          )}
        </View>
      ),
    },
    {
      key: "profile",
      component: () => (
        <View className="items-center gap-4">
          <ProfileImage user={user} isCurrentUser={isCurrentUser} />
          <View className="items-center gap-1">
            <Text className="text-2xl text-main-text">
              {user.firstName} {user.lastName}
            </Text>
            <View>
              {user.schools.map((s) => (
                <Text key={s.id} className="text-main-text/80 text-lg">
                  {s.name}
                </Text>
              ))}
            </View>
          </View>
        </View>
      ),
    },
    {
      key: "contact",
      show: !!(user as PrivateUser).email,
      title: "Contacto:",
      component: () => (
        <View className="px-2 flex-row items-center gap-2">
          <EmailIcon className="text-main-text" size={26} />
          <Text className="text-main-text text-lg">{(user as PrivateUser).email}</Text>
          {/* TODO - Poder modificar mail propio */}
        </View>
      ),
    },
    {
      key: "message",
      show: !isCurrentUser,
      component: () => (
        <CustomButton
          className="bg-secondary self-center"
          onPress={() =>
            router.push({
              pathname: "/(main)/(tabs)/messages/[userId]",
              params: { userId: user.id },
            })
          }
        >
          <ButtonText>Enviar mensaje</ButtonText>
        </CustomButton>
      ),
    },
    {
      key: "wishes",
      show: !isCurrentUser && wishes.length > 0,
      component: () => (
        <View className="gap-2">
          <Text className="text-main-text text-2xl">Lista de deseos:</Text>
          <View className="px-2 gap-2">
            {wishes.map((wish) => (
              <View key={wish.id}>
                <CategoryBadge
                  className="text-lg text-main-text/90"
                  category={wish.category}
                  colorless
                />
                {wish.comment && <Text className="text-secondary-text">{wish.comment}</Text>}
              </View>
            ))}
          </View>
        </View>
      ),
    },

    {
      key: "credits",
      show: isCurrentUser,
      title: "Loopies:",
      align: "center",
      component: () => (
        <View className="gap-4">
          <View className="px-2 flex-row items-center justify-center gap-4">
            <CreditIcon className="text-main-text" size={44} />
            <Text className="text-credits text-3xl">
              {formatNumber((user as PrivateUser).credits.balance)}
            </Text>
          </View>
          <CustomButton className="self-center w-1/2 max-w-xs" onPress={() => setIsModalOpen(true)}>
            <ButtonText>Donar</ButtonText>
          </CustomButton>
        </View>
      ),
    },
    {
      key: "pending",
      show: !isCurrentUser,
      hide: Object.keys(pendingCount).every(
        (k) => pendingCount[k as keyof typeof pendingCount] === 0,
      ),
      title: "Publicaciones pendientes:",
      component: () => (
        <View className="gap-4">
          <View className={"gap-2 " + (!pendingCount["waiting-acceptance"] ? "hidden" : "")}>
            <Text className="text-secondary-text">Esperando ser aceptadas:</Text>
            <MyPendingList
              type="waiting-acceptance"
              filterUserId={user.id}
              resultsCount={pendingCount["waiting-acceptance"]}
              setResultsCount={(count) =>
                setPendingCount((prev) => ({
                  ...prev,
                  "waiting-acceptance": count,
                }))
              }
            />
          </View>
          <View className={"gap-2 " + (!pendingCount["to-receive"] ? "hidden" : "")}>
            <Text className="text-secondary-text">Debes recibir:</Text>
            <MyPendingList
              type="to-receive"
              filterUserId={user.id}
              resultsCount={pendingCount["to-receive"]}
              setResultsCount={(count) =>
                setPendingCount((prev) => ({
                  ...prev,
                  "to-receive": count,
                }))
              }
            />
            <MyPendingList
              type="to-accept"
              filterUserId={user.id}
              resultsCount={pendingCount["to-accept"]}
              setResultsCount={(count) =>
                setPendingCount((prev) => ({
                  ...prev,
                  "to-accept": count,
                }))
              }
            />
          </View>
          <View className={"gap-2 " + (!pendingCount["to-deliver"] ? "hidden" : "")}>
            <Text className="text-secondary-text">Debes entregar:</Text>
            <MyPendingList
              type="to-deliver"
              filterUserId={user.id}
              resultsCount={pendingCount["to-deliver"]}
              setResultsCount={(count) =>
                setPendingCount((prev) => ({
                  ...prev,
                  "to-deliver": count,
                }))
              }
            />
          </View>
        </View>
      ),
    },
    {
      key: "stats",
      show: isCurrentUser,
      title: "Tus estadísticas:",
      component: () => (
        <Stats
          kgCo2={user.stats.kgCo2 || 0}
          kgWaste={user.stats.kgWaste || 0}
          lH2o={user.stats.lH2o || 0}
        />
      ),
    },
  ];

  return (
    <MainView safeBottom={canGoBack}>
      <AvoidingKeyboard>
        <DonateModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        <FlatList
          data={sections.filter((s) => s.show !== false)}
          className="flex-grow"
          refreshControl={<CustomRefresh />}
          contentContainerClassName={sectionsContentClassName}
          renderItem={({ item }) => (
            <View className={twMerge("gap-2", item.hide && "hidden")}>
              {item.title && (
                // `self-center` (not `items-center` on this row) so a centred title never
                // shrink-wraps the body below it — the body keeps its own full-width stretch
                // and controls its own internal centring (see the "credits" section).
                <Text
                  className={twMerge(
                    "text-2xl text-main-text",
                    item.align === "center" && "self-center text-center",
                  )}
                >
                  {item.title}
                </Text>
              )}
              {item.component()}
            </View>
          )}
        />
      </AvoidingKeyboard>
    </MainView>
  );
}
