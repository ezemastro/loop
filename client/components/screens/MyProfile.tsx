import { useSelf } from "@/hooks/useSelf";
import UserPage from "../UserPage";
import Loader from "../Loader";

export default function MyProfile() {
  const { data, isLoading } = useSelf();
  const user = data?.user;
  return (
    <>
      {isLoading && <Loader />}
      {user && <UserPage user={user} isCurrentUser={true} />}
    </>
  );
}
