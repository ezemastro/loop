import { useState } from "react";
import { Text } from "react-native";
import ListingSearchFiltersModal from "./modals/ListingSearchFiltersModal";
import CustomButton from "./bases/CustomButton";

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
  return (
    <>
      <CustomButton onPress={() => openModal()} className="flex-grow">
        <Text>Filtros</Text>
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
