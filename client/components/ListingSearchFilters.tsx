import { useState } from "react";
import { Text } from "react-native";
import ListingSearchFiltersModal from "./modals/ListingSearchFiltersModal";
import CustomButton from "./bases/CustomButton";
import ButtonText from "./bases/ButtonText";

export interface FiltersValue {
  school: School | null;
  category: Category | null;
  user: PrivateUser | null;
  productStatus: ProductStatus | null;
}

export default function ListingSearchFilters({
  onChange,
  value,
}: {
  onChange: (filters: FiltersValue) => void;
  value: FiltersValue;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const openModal = () => {
    setIsModalOpen(true);
  };
  const closeModal = () => {
    setIsModalOpen(false);
  };
  const filtersCount = Object.values(value).filter((v) => v !== null).length;
  return (
    <>
      <CustomButton onPress={() => openModal()} className="flex-grow">
        <ButtonText>
          Filtros{filtersCount > 0 ? ` (${filtersCount})` : ""}
        </ButtonText>
      </CustomButton>
      <ListingSearchFiltersModal
        onClose={closeModal}
        isVisible={isModalOpen}
        defaultValues={value}
        onSelect={(filters) => {
          onChange(filters);
          closeModal();
        }}
      />
    </>
  );
}
