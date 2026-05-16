import { Link } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { BellIcon, LogOutIcon, ShipWheelIcon } from "lucide-react";
import ThemeSelector from "./ThemeSelector";
import useLogout from "../hooks/useLogout";
import { useQuery } from "@tanstack/react-query";
import { getFriendRequests } from "../lib/api";

const Navbar = () => {
  const { authUser } = useAuthUser();
  const { logoutMutation } = useLogout();

  // Fetch notification count (pending friend requests)
  const { data: friendRequests } = useQuery({
    queryKey: ["friendRequests"],
    queryFn: getFriendRequests,
    refetchInterval: 30000,
  });

  const incomingCount = friendRequests?.incomingReqs?.length || 0;

  return (
    <nav className="bg-base-200 border-b border-base-300 sticky top-0 z-30 h-16 flex items-center">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between w-full">
          {/* Logo - visible on small screens where sidebar is hidden */}
          <div className="lg:hidden">
            <Link to="/" className="flex items-center gap-2">
              <ShipWheelIcon className="size-7 text-primary" />
              <span className="text-xl font-bold font-mono bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary tracking-wider">
                Streamify
              </span>
            </Link>
          </div>

          {/* Spacer for large screens where sidebar shows the logo */}
          <div className="hidden lg:block" />

          {/* Right side actions */}
          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            <Link to="/notifications">
              <button className="btn btn-ghost btn-circle relative">
                <BellIcon className="h-6 w-6 text-base-content opacity-70" />
                {incomingCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-error text-error-content text-xs font-bold rounded-full min-w-5 h-5 flex items-center justify-center px-1">
                    {incomingCount > 9 ? "9+" : incomingCount}
                  </span>
                )}
              </button>
            </Link>

            <ThemeSelector />

            <div className="avatar">
              <div className="w-9 rounded-full">
                <img src={authUser?.profilePic} alt="User Avatar" />
              </div>
            </div>

            <button className="btn btn-ghost btn-circle" onClick={logoutMutation}>
              <LogOutIcon className="h-6 w-6 text-base-content opacity-70" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;