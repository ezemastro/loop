import React from "react";
import { Tabs } from "expo-router";
import Header from "@/components/header/Header";
import { StatusBar } from "react-native";
import {
  HomeIcon,
  MyListingsIcon,
  ProfileIcon,
  PublishIcon,
  WishlistIcon,
} from "@/components/Icons";
import { COLORS } from "@/config";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.SECONDARY} />
      <Tabs
        screenOptions={{
          header: ({ route, navigation }) => (
            <Header route={route} navigation={navigation} />
          ),
          tabBarInactiveTintColor: COLORS.SECONDARY_TEXT,
          tabBarActiveTintColor: COLORS.PRIMARY,
          tabBarLabelStyle: { fontSize: 11.5, fontWeight: "600" },
          tabBarStyle: {
            height: 60 + insets.bottom,
            paddingTop: 5,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Inicio",
            tabBarIcon: ({ color, size }) => (
              <HomeIcon color={color} size={size + 2} />
            ),
          }}
        />
        <Tabs.Screen
          name="myListings"
          options={{
            title: "Mis Loops",
            tabBarIcon: ({ color, size }) => (
              <MyListingsIcon color={color} size={size + 2} />
            ),
          }}
        />
        <Tabs.Screen
          name="publish"
          options={{
            title: "Publicar",
            tabBarIcon: ({ color, size }) => (
              <PublishIcon
                color={color}
                size={size + 8}
                style={{ top: -2, height: 32, textAlign: "right" }}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="wishlist"
          options={{
            title: "Deseados",
            tabBarIcon: ({ color, size }) => (
              <WishlistIcon color={color} size={size + 2} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Perfil",
            tabBarIcon: ({ color, size }) => (
              <ProfileIcon color={color} size={size + 2} />
            ),
          }}
        />
        <Tabs.Screen name="search" options={{ title: "Buscar", href: null }} />
        <Tabs.Screen
          name="messages"
          options={{ title: "Mensajes", href: null }}
        />
        <Tabs.Screen
          name="notifications"
          options={{ title: "Notificaciones", href: null }}
        />
      </Tabs>
    </>
  );
}
