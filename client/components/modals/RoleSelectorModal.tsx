import { useRoles } from "@/hooks/useRoles";
import ResourceSelectorModal from "../bases/ResourceSelectorModal";
import Role from "../cards/Role";

export default function RoleSelectorModal({
  isVisible,
  onClose,
  onSelect,
}: {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (role: Role) => void;
}) {
  return (
    <ResourceSelectorModal<Role>
      isVisible={isVisible}
      onClose={onClose}
      onSelect={onSelect}
      title="Seleccione un rol"
      useResource={useRoles}
      renderItem={(role) => <Role role={role} />}
      getItems={(data) => data?.pages.flatMap((page: any) => page.roles) || []}
      getTotal={(data) => data?.pages[0].pagination.totalRecords}
      filterItems={(items, searchTerm) =>
        items.filter((i) =>
          i.name.toLowerCase().includes(searchTerm.toLowerCase()),
        )
      }
    />
  );
}
