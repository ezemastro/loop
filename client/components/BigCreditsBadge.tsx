import CreditsBadge from "./badges/CreditsBadge";

export default function BigCreditsBadge({
  credits,
  containerClassName,
  numberClassName,
  iconSize,
}: {
  credits: number;
  containerClassName?: string;
  numberClassName?: string;
  iconSize?: number;
}) {
  return (
    <CreditsBadge
      credits={credits}
      containerClassName={`gap-3 ${containerClassName}`}
      numberClassName={`!text-2xl ${numberClassName}`}
      iconSize={iconSize || 32}
    />
  );
}
