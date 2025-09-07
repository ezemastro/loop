import ResourceSelectorModal from "../bases/ResourceSelectorModal";
import { useSchools } from "@/hooks/useSchools";
import School from "../cards/School";

export default function SchoolSelectorModal({
  isVisible,
  onClose,
  onSelect,
}: {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (school: School) => void;
}) {
  return (
    <ResourceSelectorModal<School>
      isVisible={isVisible}
      onClose={onClose}
      onSelect={onSelect}
      title="Seleccione una escuela"
      useResource={useSchools}
      renderItem={(school) => <School school={school} />}
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
