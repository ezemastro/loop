import { useEffect, useState, useCallback, useRef } from "react";
import { Image, Modal, Platform, Pressable, View, Text, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useThemeColors } from "@/hooks/useThemeColors";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const STORAGE_KEY = "pwa_install_prompt_dismissed";
const DISMISS_COOLDOWN_DAYS = 7;

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function getDaysSince(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime();
  return diff / (1000 * 60 * 60 * 24);
}

export default function PwaInstallPrompt() {
  const colors = useThemeColors();
  const [visible, setVisible] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const hasCheckedRef = useRef(false);

  const handleBeforeInstallPrompt = useCallback((event: Event) => {
    event.preventDefault();
    deferredPromptRef.current = event as BeforeInstallPromptEvent;
    setVisible(true);
  }, []);

  const appInstalled = useCallback(() => {
    deferredPromptRef.current = null;
    setVisible(false);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    if (!isMobileDevice() || isStandalone()) return;

    setIsIOSDevice(isIOS());

    const checkAndShow = async () => {
      try {
        const dismissed = await AsyncStorage.getItem(STORAGE_KEY);
        if (dismissed && getDaysSince(dismissed) < DISMISS_COOLDOWN_DAYS) {
          return;
        }

        if (isIOS()) {
          setTimeout(() => setVisible(true), 3000);
          return;
        }
      } catch {
        if (isIOS()) {
          setTimeout(() => setVisible(true), 3000);
        }
      }
    };

    checkAndShow();

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", appInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", appInstalled);
    };
  }, [handleBeforeInstallPrompt, appInstalled]);

  const handleInstall = useCallback(async () => {
    if (deferredPromptRef.current) {
      await deferredPromptRef.current.prompt();
      const choice = await deferredPromptRef.current.userChoice;
      if (choice.outcome === "accepted") {
        setVisible(false);
      }
      deferredPromptRef.current = null;
    }
  }, []);

  const handleDismiss = useCallback(async () => {
    setVisible(false);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {}
  }, []);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      onRequestClose={handleDismiss}
      transparent
      statusBarTranslucent
      animationType="fade"
    >
      <Pressable
        onPress={handleDismiss}
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          justifyContent: "flex-end",
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: "#FFFFFF",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingHorizontal: 24,
            paddingTop: 28,
            paddingBottom: 40,
            maxHeight: "80%",
          }}
        >
          <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
            <View style={{ alignItems: "center" }}>
              <View
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 16,
                  backgroundColor: colors.SECONDARY,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <Image
                  source={require("../assets/icon.png")}
                  resizeMode="contain"
                  style={{ width: 44, height: 44 }}
                />
              </View>

              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "700",
                  color: colors.MAIN_TEXT,
                  marginBottom: 8,
                  textAlign: "center",
                }}
              >
                Instalá Loop en tu celular
              </Text>

              <Text
                style={{
                  fontSize: 14,
                  color: colors.SECONDARY_TEXT,
                  textAlign: "center",
                  lineHeight: 20,
                  marginBottom: 24,
                }}
              >
                Agregá Loop a la pantalla de inicio para acceder más rápido y usarla como una app.
              </Text>

              {isIOSDevice ? (
                <View style={{ width: "100%", gap: 20 }}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: colors.PRIMARY,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "700" }}>1</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: "600", color: colors.MAIN_TEXT }}>
                        Tocá el botón Compartir
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.SECONDARY_TEXT, marginTop: 2 }}>
                        En la barra inferior de Safari, presioná el ícono{" "}
                        <Text style={{ fontSize: 16 }}>↗</Text>
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: colors.PRIMARY,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "700" }}>2</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: "600", color: colors.MAIN_TEXT }}>
                        Agregar a la pantalla de inicio
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.SECONDARY_TEXT, marginTop: 2 }}>
                        Deslizá y seleccioná &quot;Agregar a inicio&quot; en el menú
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={handleInstall}
                  style={{
                    backgroundColor: colors.PRIMARY,
                    paddingVertical: 14,
                    paddingHorizontal: 32,
                    borderRadius: 12,
                    width: "100%",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
                    Instalar Loop
                  </Text>
                </Pressable>
              )}

              <Pressable onPress={handleDismiss} style={{ marginTop: 20, padding: 8 }}>
                <Text style={{ fontSize: 14, color: colors.SECONDARY_TEXT }}>
                  {isIOSDevice ? "Entendido" : "Ahora no"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
