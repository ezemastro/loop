import CustomModal from "../bases/CustomModal";
import { Text, TextInput, View } from "react-native";
import TextTitle from "../bases/TextTitle";
import CloseModalButton from "../CloseModalButton";
import UserSelector from "../selectors/UserSelector";
import { useState } from "react";
import CustomButton from "../bases/CustomButton";
import ButtonText from "../bases/ButtonText";
import { CreditIcon } from "../Icons";
import { formatNumber } from "@/utils/formatNumber";
import { useAuth } from "@/hooks/useAuth";
import { useUserDonate } from "@/hooks/useDonate";
import { useQueryClient } from "@tanstack/react-query";
import Error from "../Error";

export default function DonateModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const { user } = useAuth();
  const { mutate: donate } = useUserDonate();

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
      },
    );
  };
  return (
    <CustomModal handleClose={onClose} isVisible={isOpen}>
      <View className="gap-4 bg-background p-6 rounded-lg w-full">
        <CloseModalButton onClose={onClose} />
        <TextTitle>Donar Loopies</TextTitle>
        <View className="gap-2">
          <Text className="text-main-text text-lg">Donar a:</Text>
          <UserSelector value={selectedUser} onChange={setSelectedUser} />
          {selectedUser?.id === user?.id && (
            <Error>No puedes donar a ti mismo</Error>
          )}
        </View>
        <View className="gap-2">
          <Text className="text-main-text text-lg">Cantidad:</Text>
          <View className="flex-row items-center bg-white rounded border border-stroke px-4 gap-2">
            <CreditIcon size={32} />
            <TextInput
              keyboardType="numeric"
              placeholder="0"
              className="text-credits flex-grow"
              value={amount !== null ? formatNumber(amount) : ""}
              onChangeText={(text) => {
                const number = Number(text.replace(/[.,]/g, ""));
                if (Number.isNaN(number)) return;
                setAmount(number);
              }}
            />
          </View>
          <Text className="text-sm text-secondary-text text-right">
            Max. {formatNumber(user!.credits.balance)}
          </Text>
        </View>
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
