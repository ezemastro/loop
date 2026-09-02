import { Alert, Platform } from "react-native";
import { emitGlobalApiError } from "@/api/loop";

export type AlertAction = { text: string; onPress?: () => void; style?: "cancel" };

/**
 * `Alert.alert` is a no-op on React Native Web, so any code path that used it silently showed
 * nothing on web. `showAlert` is a plain function (not a hook) so it is callable from
 * `useMailComposer`'s non-component scope — it reaches the toast through the same module-scope
 * emitter `ToastProvider` already subscribes to (`api/loop.ts`'s `onGlobalApiError`), avoiding a
 * hook-order dependency.
 *
 * Native delegates verbatim to `Alert.alert` — zero behaviour change there. On web, `Toast` cannot
 * render action buttons, so with actions the *caller* is expected to degrade (open its own web
 * fallback UI) rather than `showAlert` guessing; it still surfaces the message and runs the first
 * non-cancel action so that behaviour, not just the dialog, keeps happening.
 */
export function showAlert(title: string, message: string, actions?: AlertAction[]): void {
  if (Platform.OS !== "web") {
    if (actions && actions.length > 0) {
      Alert.alert(title, message, actions);
    } else {
      Alert.alert(title, message);
    }
    return;
  }

  emitGlobalApiError(`${title}. ${message}`);

  const primaryAction = actions?.find((action) => action.style !== "cancel");
  primaryAction?.onPress?.();
}
