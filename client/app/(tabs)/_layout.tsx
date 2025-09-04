import React from "react";
import { Tabs } from "expo-router";
import Header from "@/components/header/Header";
import { StatusBar } from "react-native";

export default function TabsLayout() {
  return (
    <>
      <StatusBar barStyle="light-content" />
      <Tabs screenOptions={{ header: ({ route }) => <Header route={route} /> }}>
        <Tabs.Screen name="index" options={{ title: "Home" }} />
      </Tabs>
    </>
  );
}
