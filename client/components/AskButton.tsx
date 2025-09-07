import CustomButton from "./bases/CustomButton";
import { MessageIcon } from "./Icons";
import ButtonText from "./bases/ButtonText";

export default function AskButton() {
  return (
    <CustomButton className="flex-row items-center gap-2" onPress={() => {}}>
      <MessageIcon className="text-white" />
      <ButtonText className="font-light">Preguntar</ButtonText>
    </CustomButton>
  );
}
