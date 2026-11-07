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
import TextTitle from "./bases/TextTitle";
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
      show: canGoBack,
      component: () => (
        <View className="flex-row">
          <BackButton />
        </View>
      ),
    },
    {
      key: "profile",
      component: () => (
        <View className="gap-3 rounded-xl border border-stroke bg-white p-4">
          <View className="flex-row items-center gap-4">
            <ProfileImage user={user} isCurrentUser={isCurrentUser} />
            <View className="min-w-0 flex-1 gap-0.5">
              <Text className="text-xl font-semibold text-main-text">
                {user.firstName} {user.lastName}
              </Text>
              {user.schools.map((s) => (
                <Text key={s.id} className="text-sm text-secondary-text">
                  {s.name}
                </Text>
              ))}
            </View>
            {isCurrentUser && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Configuración"
                className="h-11 w-11 items-center justify-center rounded-full web:cursor-pointer hover:bg-background"
                onPress={() => router.push("/(main)/settings")}
              >
                <SettingsIcon className="text-main-text" size={24} />
              </Pressable>
            )}
          </View>
          {!!(user as PrivateUser).email && (
            <View className="flex-row items-center gap-2">
              <EmailIcon className="text-secondary-text" size={16} />
              <Text className="text-sm text-secondary-text">{(user as PrivateUser).email}</Text>
              {/* TODO - Poder modificar mail propio */}
            </View>
          )}
        </View>
      ),
    },
    {
      key: "message",
      show: !isCurrentUser,
      component: () => (
        <CustomButton
          className="max-w-none"
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
          <Text className="text-main-text text-lg font-semibold">Lista de deseos</Text>
          <View className="px-2 gap-2">
            {wishes.map((wish) => (
              <View key={wish.id}>
                <CategoryBadge className="text-lg text-main-text/90" category={wish.category} />
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
      title: "Loopies",
      component: () => (
        <View className="flex-row items-center justify-between gap-4 rounded-xl border border-stroke bg-white p-4">
          <View className="flex-row items-center gap-3">
            <CreditIcon size={32} />
            <Text className="text-2xl font-semibold text-credits">
              {formatNumber((user as PrivateUser).credits.balance)}
            </Text>
          </View>
          <CustomButton
            variant="secondary"
            className="w-auto max-w-none"
            onPress={() => setIsModalOpen(true)}
          >
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
      title: "Loops pendientes",
      component: () => (
        <View className="gap-4">
          <View className={"gap-2 " + (!pendingCount["waiting-acceptance"] ? "hidden" : "")}>
            <Text className="text-sm font-semibold text-secondary-text">Esperando aceptación</Text>
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
            <Text className="text-sm font-semibold text-secondary-text">Tenés que recibir</Text>
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
            <Text className="text-sm font-semibold text-secondary-text">Tenés que entregar</Text>
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
      title: "Tu impacto",
      component: () => (
        <Stats
          kgCo2={user.stats.kgCo2 || 0}
          kgWaste={user.stats.kgWaste || 0}
          lH2o={user.stats.lH2o || 0}
        />
      ),
    },
    {
      key: "report",
      show: !isCurrentUser,
      component: () => (
        <View className="flex-row">
          <ReportButton user={user} label="Denunciar" />
        </View>
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
              {item.title && <TextTitle level="section">{item.title}</TextTitle>}
              {item.component()}
            </View>
          )}
        />
      </AvoidingKeyboard>
    </MainView>
  );
}
