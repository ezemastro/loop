import ResourceSelectorModal from "../bases/ResourceSelectorModal";
import { useSchools } from "@/hooks/useSchools";
import School from "../cards/School";

export default function SchoolSelectorModal({
  isVisible,
  onClose,
  onSelect,
  multiple = false,
}: {
  isVisible: boolean;
  multiple?: boolean;
  onClose: () => void;
  onSelect: (school: School[]) => void;
}) {
  return (
    <ResourceSelectorModal<School>
      multiple={multiple}
      isVisible={isVisible}
      onClose={onClose}
      onSelect={(schools) => onSelect(schools as School[])}
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
