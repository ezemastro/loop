import ResourceSelectorModal from "../bases/ResourceSelectorModal";
import { useSchools } from "@/hooks/useSchools";
import School from "../cards/School";

/**
 * `communityId` distingue tres situaciones:
 * - `undefined`: no se filtra desde el cliente; el servidor usa la comunidad de la sesión.
 * - un UUID: registro sin sesión, ya sabemos a qué comunidad pertenece el usuario.
 * - `null`: registro sin sesión y todavía sin comunidad resuelta → no consultar (sería un 400).
 */
type CommunityFilter = { communityId?: UUID | null };

type SchoolSelectorModalSingleProps = CommunityFilter & {
  isVisible: boolean;
  multiple?: false;
  onClose: () => void;
  onSelect: (school: School) => void;
};

type SchoolSelectorModalMultipleProps = CommunityFilter & {
  isVisible: boolean;
  multiple: true;
  onClose: () => void;
  onSelect: (schools: School[]) => void;
};

type SchoolSelectorModalProps = SchoolSelectorModalSingleProps | SchoolSelectorModalMultipleProps;

export default function SchoolSelectorModal({
  isVisible,
  onClose,
  onSelect,
  multiple,
  communityId,
}: SchoolSelectorModalProps) {
  // El selector genérico invoca `useResource` en su propio render, así que esto sigue siendo una
  // llamada a hook de nivel superior; el nombre `use*` es lo que lo deja explícito.
  const useSchoolsOfCommunity = (params: { searchTerm: string }) =>
    useSchools(
      { ...params, ...(communityId ? { communityId } : {}) },
      { enabled: communityId !== null },
    );

  return (
    <ResourceSelectorModal<School>
      multiple={multiple}
      isVisible={isVisible}
      onClose={onClose}
      onSelect={(schools: School | School[]) => onSelect(schools as any)}
      title="Seleccione las escuelas"
      useResource={useSchoolsOfCommunity}
      renderItem={(school, options) => <School school={school} isSelected={options?.isSelected} />}
      getItems={(data) => data?.pages.flatMap((page: any) => page.schools) || []}
      getTotal={(data) => data?.pages[0].pagination.totalRecords}
      filterItems={(items, searchTerm) =>
        items.filter((i) => i.name.toLowerCase().includes(searchTerm.toLowerCase()))
      }
    />
  );
}
