import { useEffect, useRef, useState } from "react";
import { useDebounce } from "use-debounce";
import { useRegister } from "./useRegister";
import { useInvitation } from "./useInvitation";
import { useResolveCommunity } from "./useResolveCommunity";
import { validateRegisterForm } from "@/services/validations";
import { z } from "zod";
import { getUserFriendlyErrorMessage } from "@/services/errorMapping";
import { useThemeStore } from "@/stores/theme";

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  schools: School[] | null;
}
type FormErrors = Record<keyof FormData, string | null>;
const INITIAL_ERRORS: FormErrors = {
  confirmPassword: null,
  email: null,
  firstName: null,
  lastName: null,
  password: null,
  schools: null,
};

/** Espera a que el usuario deje de tipear antes de preguntarle al servidor por el dominio. */
const RESOLVE_DEBOUNCE_MS = 400;

/** Un correo sirve para resolver comunidad solo cuando ya tiene un dominio con punto. */
const hasResolvableDomain = (email: string) => {
  const domain = email.split("@")[1];
  return Boolean(domain && domain.includes(".") && !domain.endsWith("."));
};

export const useRegisterForm = (invitationToken?: string) => {
  const {
    mutate: register,
    isError: isRegisterError,
    error: registerError,
    isPending: isLoading,
  } = useRegister();
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    schools: null,
  });
  const [errors, setErrors] = useState<FormErrors>(INITIAL_ERRORS);

  const invitation = useInvitation(invitationToken);
  const invitationCommunity = invitation.data?.community ?? null;

  // Con invitación válida el dominio del correo deja de importar, así que ni consultamos.
  const [debouncedEmail] = useDebounce(formData.email.trim(), RESOLVE_DEBOUNCE_MS);
  const emailToResolve =
    !invitationCommunity && hasResolvableDomain(debouncedEmail) ? debouncedEmail : undefined;
  const resolveQuery = useResolveCommunity({ email: emailToResolve });
  const resolvedCommunity = emailToResolve ? (resolveQuery.data ?? null) : null;

  // La invitación gana: define la comunidad a la que entra el usuario sin importar su correo.
  const community = invitationCommunity ?? resolvedCommunity;

  const setPreview = useThemeStore((state) => state.setPreview);
  useEffect(() => {
    // Pinta el registro con los colores de la comunidad detectada.
    setPreview(community);
  }, [community, setPreview]);

  // Los colegios elegidos pertenecen a una comunidad concreta: si cambia, dejan de ser válidos.
  const lastCommunityIdRef = useRef<string | null>(null);
  useEffect(() => {
    const communityId = community?.id ?? null;
    if (lastCommunityIdRef.current !== null && lastCommunityIdRef.current !== communityId) {
      setFormData((prev) => (prev.schools ? { ...prev, schools: null } : prev));
    }
    lastCommunityIdRef.current = communityId;
  }, [community?.id]);

  const handleSubmit = () => {
    const parsedFromData = {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: formData.email.trim(),
      password: formData.password.trim(),
      confirmPassword: formData.confirmPassword.trim(),
      schools: formData.schools,
    };
    const validationResult = validateRegisterForm(parsedFromData);
    if (validationResult.success) {
      setErrors(INITIAL_ERRORS);
      register({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        schoolIds: formData.schools!.map((school) => school.id),
        ...(invitationCommunity && invitationToken ? { invitationToken } : {}),
      });
    } else {
      const formattedErrors = z.formatError(validationResult.error);
      setErrors({
        firstName: formattedErrors.firstName?._errors[0] || null,
        lastName: formattedErrors.lastName?._errors[0] || null,
        email: formattedErrors.email?._errors[0] || null,
        password: formattedErrors.password?._errors[0] || null,
        confirmPassword:
          formData.password !== formData.confirmPassword ? "Las contraseñas no coinciden" : null,
        schools: formattedErrors.schools?._errors[0] || null,
      });
    }
  };

  const displayError = isRegisterError ? getUserFriendlyErrorMessage(registerError) : undefined;

  return {
    formData,
    setFormData,
    errors,
    handleSubmit,
    isRegisterError,
    registerError,
    displayError,
    isLoading,
    /** Comunidad efectiva del registro: la de la invitación o la del dominio del correo. */
    community,
    isResolvingCommunity: resolveQuery.isFetching,
    /** El correo tipeado tiene un dominio que no pertenece a ninguna comunidad. */
    isCommunityNotFound: Boolean(emailToResolve) && resolveQuery.isSuccess && !resolveQuery.data,
    invitation: {
      token: invitationToken,
      community: invitationCommunity,
      isLoading: invitation.isLoading,
      isError: invitation.isError,
      errorMessage: invitation.isError ? getUserFriendlyErrorMessage(invitation.error) : undefined,
    },
  };
};
