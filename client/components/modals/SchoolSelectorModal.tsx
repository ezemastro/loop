import ResourceSelectorModal from "../bases/ResourceSelectorModal";
import { useSchools } from "@/hooks/useSchools";
import School from "../cards/School";

type SchoolSelectorModalSingleProps = {
  isVisible: boolean;
  multiple?: false;
  onClose: () => void;
  onSelect: (school: School) => void;
};

type SchoolSelectorModalMultipleProps = {
  isVisible: boolean;
  multiple: true;
  onClose: () => void;
  onSelect: (schools: School[]) => void;
};

type SchoolSelectorModalProps =
  | SchoolSelectorModalSingleProps
  | SchoolSelectorModalMultipleProps;

export default function SchoolSelectorModal({
  isVisible,
  onClose,
  onSelect,
  multiple,
}: SchoolSelectorModalProps) {
  return (
    <ResourceSelectorModal<School>
      multiple={multiple}
      isVisible={isVisible}
      onClose={onClose}
      onSelect={(schools: School | School[]) => onSelect(schools as any)}
      title="Seleccione las escuelas"
      useResource={useSchools}
      renderItem={(school, options) => (
        <School school={school} isSelected={options?.isSelected} />
      )}
      getItems={(data) =>
        data?.pages.flatMap((page: any) => page.schools) || []
      }
      getTotal={(data) => data?.pages[0].pagination.totalRecords}
      filterItems={(items, searchTerm) =>
        items.filter((i) =>
          i.name.toLowerCase().includes(searchTerm.toLowerCase()),
        )
      }
    />
  );
}
