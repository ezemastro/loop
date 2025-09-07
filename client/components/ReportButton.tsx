import ButtonText from "./bases/ButtonText";
import CustomButton from "./bases/CustomButton";

export default function ReportButton() {
  return (
    <CustomButton className="bg-red-500">
      <ButtonText>Reportar</ButtonText>
    </CustomButton>
  );
}
