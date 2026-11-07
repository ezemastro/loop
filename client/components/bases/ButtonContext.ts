import { createContext, useContext } from "react";
import type { ButtonSize, ButtonVariant } from "./buttonStyles";

export type ButtonContextValue = { variant: ButtonVariant; size: ButtonSize };

/** Lets `ButtonText` pick its colour and size from the enclosing `CustomButton`. */
export const ButtonContext = createContext<ButtonContextValue>({ variant: "primary", size: "md" });

export const useButtonContext = () => useContext(ButtonContext);
