import { useEffect, useState, useCallback, useRef } from "react";
import { Modal, Platform, Pressable, View, Text, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
                  backgroundColor: "#FF5900",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 28, fontWeight: "700" }}>L</Text>
              </View>

              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "700",
                  color: "#424242",
                  marginBottom: 8,
                  textAlign: "center",
                }}
              >
                Instalá Loop en tu celular
              </Text>

              <Text
                style={{
                  fontSize: 14,
                  color: "#9E9E9E",
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
                        backgroundColor: "#FF5900",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "700" }}>1</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: "600", color: "#424242" }}>
                        Tocá el botón Compartir
                      </Text>
                      <Text style={{ fontSize: 13, color: "#9E9E9E", marginTop: 2 }}>
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
                        backgroundColor: "#FF5900",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "700" }}>2</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: "600", color: "#424242" }}>
                        Agregar a la pantalla de inicio
                      </Text>
                      <Text style={{ fontSize: 13, color: "#9E9E9E", marginTop: 2 }}>
                        Deslizá y seleccioná &quot;Agregar a inicio&quot; en el menú
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={handleInstall}
                  style={{
                    backgroundColor: "#FF5900",
                    paddingVertical: 14,
                    paddingHorizontal: 32,
                    borderRadius: 12,
                    width: "100%",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}
                  >
                    Instalar Loop
                  </Text>
                </Pressable>
              )}

              <Pressable onPress={handleDismiss} style={{ marginTop: 20, padding: 8 }}>
                <Text style={{ fontSize: 14, color: "#9E9E9E" }}>
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
