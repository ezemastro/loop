import type { AdminCommunity } from "@/api/adminApi";
import { Select } from "@/components/ui";

interface CommunityFilterProps {
  communities: AdminCommunity[];
  value: UUID | null;
  onChange: (communityId: UUID | null) => void;
  /** Si es false, obliga a elegir una comunidad concreta (no existe la opción "todas"). */
  allowAll?: boolean;
  loading?: boolean;
  label?: string;
}

/**
 * Filtro de comunidad para un super admin. Las páginas lo montan solo cuando el rol lo justifica:
 * un community_admin no tiene nada que elegir.
 */
export default function CommunityFilter({
  communities,
  value,
  onChange,
  allowAll = true,
  loading = false,
  label = "Comunidad",
}: CommunityFilterProps) {
  return (
    <div className="w-full sm:w-64">
      <label
        htmlFor="community-filter"
        className="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase"
      >
        {label}
      </label>
      <Select
        id="community-filter"
        value={value ?? ""}
        disabled={loading}
        onChange={(e) => onChange(e.target.value || null)}
      >
        {allowAll ? (
          <option value="">Todas las comunidades</option>
        ) : (
          <option value="" disabled>
            {loading ? "Cargando…" : "Elegí una comunidad"}
          </option>
        )}
        {communities.map((community) => (
          <option key={community.id} value={community.id}>
            {community.name}
            {community.active ? "" : " (inactiva)"}
          </option>
        ))}
      </Select>
    </div>
  );
}
