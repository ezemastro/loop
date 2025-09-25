import { useAuth } from "@/hooks/useAuth";
import { useLocalSearchParams } from "expo-router";
import UserPage from "../UserPage";
import { useUser } from "@/hooks/useUser";
import Loader from "../Loader";

export default function OtherUser() {
  const { userId } = useLocalSearchParams();
  const { user: currentUser } = useAuth();
  const { data, isLoading } = useUser({ userId: userId as string });
  const user = data?.user;
  const isCurrentUser = currentUser?.id === userId;
  return (
    <>
      {isCurrentUser && (
        <UserPage
          user={currentUser}
          isCurrentUser={isCurrentUser}
          canGoBack={true}
        />
      )}
      {isLoading && !isCurrentUser && <Loader />}
      {user && !isCurrentUser && (
        <UserPage user={user} isCurrentUser={isCurrentUser} canGoBack={true} />
      )}
    </>
  );
}
