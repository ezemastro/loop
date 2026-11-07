import CustomModal from "../bases/CustomModal";
import { View } from "react-native";
import ModalHeader, { modalSurfaceClassName } from "../bases/ModalHeader";
import UserSelector from "../selectors/UserSelector";
import { useState } from "react";
import CustomButton from "../bases/CustomButton";
import ButtonText from "../bases/ButtonText";
import { CreditIcon } from "../Icons";
import { formatNumber } from "@/utils/formatNumber";
import { useAuth } from "@/hooks/useAuth";
import { useUserDonate } from "@/hooks/useDonate";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ToastProvider";
import { getUserFriendlyErrorMessage } from "@/services/errorMapping";
import { Field, TextField } from "../bases/Field";

export default function DonateModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  // `PublicUser`, no `User`: lo que elige `UserSelector` viene de `GET /users`, y por la
  // invariante de privacidad esa lista nunca trae email, teléfono ni créditos. Un `User` completo
  // no cruza la red.
  const [selectedUser, setSelectedUser] = useState<PublicUser | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const { user } = useAuth();
  const { mutate: donate } = useUserDonate();
  const { showToast } = useToast();

  const handleDonate = () => {
    if (
      !selectedUser ||
      !amount ||
      amount <= 0 ||
      selectedUser.id === user?.id ||
      amount > user!.credits.balance
    )
      return;
    donate(
      { userId: selectedUser!.id, amount },
      {
        onSuccess: () => {
          setSelectedUser(null);
          setAmount(null);
          onClose();
          queryClient.invalidateQueries({ queryKey: ["self"] });
        },
        onError: (error) => {
          showToast(getUserFriendlyErrorMessage(error), "error");
        },
      },
    );
  };
  return (
    <CustomModal handleClose={onClose} isVisible={isOpen}>
      <View className={modalSurfaceClassName()}>
        <ModalHeader title="Donar loopies" onClose={onClose} />
        <Field
          label="Donar a"
          error={selectedUser?.id === user?.id ? "No podés donarte a vos mismo" : null}
        >
          <UserSelector value={selectedUser} onChange={setSelectedUser} />
        </Field>
        <Field label="Cantidad" helper={`Máximo ${formatNumber(user!.credits.balance)}`}>
          <TextField
            keyboardType="numeric"
            placeholder="0"
            leading={<CreditIcon size={22} />}
            className="text-credits"
            value={amount !== null ? formatNumber(amount) : ""}
            onChangeText={(text) => {
              const number = Number(text.replace(/[.,]/g, ""));
              if (Number.isNaN(number)) return;
              setAmount(number);
            }}
          />
        </Field>
        <CustomButton
          disabled={
            !selectedUser ||
            !amount ||
            amount <= 0 ||
            amount > user!.credits.balance ||
            selectedUser.id === user?.id
          }
          onPress={handleDonate}
        >
          <ButtonText>Donar</ButtonText>
        </CustomButton>
      </View>
    </CustomModal>
  );
}
