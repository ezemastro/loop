import type { ComponentType } from "react";
import type { IconProps } from "@expo/vector-icons/build/createIconSet";
import { DeleteIcon, EmailIcon, LogoutIcon, MessageIcon, ReportProblemIcon } from "../Icons";
import type { SupportMailTemplate } from "@/services/supportMail";

export type SettingsAction =
  | { kind: "logout" }
  | { kind: "deleteAccount" }
  | { kind: "mail"; template: SupportMailTemplate };

export interface SettingsItem {
  key: string;
  label: string;
  description?: string;
  // `& { color?: string }` matches the Feather-based icon components' actual signature (see
  // `Icons.tsx`) — narrower than plain `Partial<IconProps<string>>`, which only the Ionicons-based
  // `PRIMARY_TABS` icons satisfy.
  Icon: ComponentType<Partial<IconProps<string>> & { color?: string }>;
  variant?: "default" | "destructive";
  action: SettingsAction;
}

export interface SettingsGroup {
  key: string;
  title: string;
  items: SettingsItem[];
}

/**
 * Single source of truth for the settings list, mirroring `primaryTabs.ts` — presentation and
 * intent live here, handlers stay in `Settings.tsx` (see design.md D3). Adding a future group is
 * appending a `SettingsGroup` plus one `action.kind` case in the screen.
 */
export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    key: "account",
    title: "Cuenta y sesión",
    items: [
      {
        key: "logout",
        label: "Cerrar sesión",
        Icon: LogoutIcon,
        action: { kind: "logout" },
      },
      {
        key: "deleteAccount",
        label: "Eliminar cuenta",
        description: "Esta acción es permanente e irreversible",
        Icon: DeleteIcon,
        variant: "destructive",
        action: { kind: "deleteAccount" },
      },
    ],
  },
  {
    key: "contact",
    title: "Contacto",
    items: [
      {
        key: "reportBug",
        label: "Reportar un error",
        Icon: ReportProblemIcon,
        action: { kind: "mail", template: "bug" },
      },
      {
        key: "sendSuggestion",
        label: "Enviar una sugerencia",
        Icon: MessageIcon,
        action: { kind: "mail", template: "suggestion" },
      },
      {
        key: "contactTeam",
        label: "Contactar con el equipo",
        Icon: EmailIcon,
        action: { kind: "mail", template: "contact" },
      },
    ],
  },
];
