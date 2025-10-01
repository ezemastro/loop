import ResourceSelectorModal from "../bases/ResourceSelectorModal";
import User from "../cards/User";
import { useUsers } from "@/hooks/useUsers";

export default function UserSelectorModal({
  isVisible,
  onClose,
  onSelect,
}: {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (user: User) => void;
}) {
  return (
    <ResourceSelectorModal<User>
      isVisible={isVisible}
      onClose={onClose}
      onSelect={(user) => onSelect(user as User)}
      title="Seleccione un usuario"
      useResource={useUsers}
      renderItem={(user) => <User user={user} />}
      getItems={(data) =>
        data?.pages.flatMap((page: any) => page.data.users) || []
      }
      getTotal={(data) => data?.pages[0].pagination.totalRecords}
      filterItems={(items, searchTerm) =>
        items.filter((i) =>
          [i.firstName, i.lastName]
            .join(" ")
            .toLowerCase()
            .includes(searchTerm.toLowerCase()),
        )
      }
    />
  );
}
