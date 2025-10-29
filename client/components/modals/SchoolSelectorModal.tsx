import ResourceSelectorModal from "../bases/ResourceSelectorModal";
import { useSchools } from "@/hooks/useSchools";
import School from "../cards/School";

type SchoolSelectorModalProps<M extends boolean = false> = {
  isVisible: boolean;
  multiple?: M;
  onClose: () => void;
  onSelect: (school: M extends true ? School[] : School) => void;
};

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
      onSelect={(schools) => onSelect(schools)}
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
