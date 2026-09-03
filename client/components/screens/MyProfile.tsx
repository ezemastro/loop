import { useSelf } from "@/hooks/useSelf";
import UserPage from "../UserPage";
import Loader from "../Loader";

export default function MyProfile() {
  // `isPending`, not `isLoading`: `useSelf` stays disabled until the session store rehydrates, and
  // a disabled query reports `isLoading === false` with no data -- which would flash an empty page
  // instead of the loader.
  const { data, isPending } = useSelf();
  const user = data?.user;
  return (
    <>
      {isPending && <Loader />}
      {user && <UserPage user={user} isCurrentUser={true} />}
    </>
  );
}
