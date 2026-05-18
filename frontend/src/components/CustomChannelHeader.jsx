import { useChannelStateContext, useChatContext } from "stream-chat-react";
import { ArrowLeftIcon, PhoneIcon, VideoIcon } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Unified chat header: back button, avatar, name/status, AND call buttons
 * all on the same line — replacing the separate CallButton overlay.
 */
const CustomChannelHeader = ({ friend, onBack, handleVideoCall, handleAudioCall }) => {
  const { channel } = useChannelStateContext();
  const { client } = useChatContext();
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    if (!friend || !channel) return;

    // Set initial status
    const members = Object.values(channel?.state?.members || {});
    const friendMember = members.find((m) => m.user?.id === friend._id);
    setIsOnline(friendMember?.user?.online ?? false);

    // Listen for presence changes in real-time
    const handlePresenceChange = (event) => {
      if (event.user?.id === friend._id) {
        setIsOnline(event.user.online);
      }
    };

    client.on("user.presence.changed", handlePresenceChange);

    return () => {
      client.off("user.presence.changed", handlePresenceChange);
    };
  }, [friend, channel, client]);

  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b border-base-300 bg-base-100 w-full shrink-0">
      {/* Back button — mobile only */}
      {onBack && (
        <button
          onClick={onBack}
          className="btn btn-ghost btn-sm btn-circle md:hidden shrink-0"
          title="Back to chats"
        >
          <ArrowLeftIcon className="size-5" />
        </button>
      )}

      {/* Avatar with online dot */}
      <div className="relative shrink-0">
        <img
          src={friend.profilePic || "/avatar.png"}
          alt={friend.fullName}
          className="size-10 rounded-full object-cover border border-base-300"
        />
        {isOnline && (
          <span className="absolute bottom-0 right-0 size-3 bg-success border-2 border-base-100 rounded-full" />
        )}
      </div>

      {/* Name + status — grows to fill available space */}
      <div className="flex flex-col flex-1 min-w-0">
        <span className="font-semibold text-sm sm:text-base leading-tight truncate">
          {friend.fullName}
        </span>
        <span
          className={`text-xs leading-tight ${
            isOnline ? "text-success" : "text-base-content/50"
          }`}
        >
          {isOnline ? "● Online" : "● Offline"}
        </span>
      </div>

      {/* Call buttons — right-aligned on the same row */}
      <div className="flex gap-2 shrink-0">
        {handleAudioCall && (
          <button
            onClick={handleAudioCall}
            className="btn btn-primary btn-sm text-white shadow-sm"
            title="Audio Call"
          >
            <PhoneIcon className="size-4" />
          </button>
        )}
        {handleVideoCall && (
          <button
            onClick={handleVideoCall}
            className="btn btn-success btn-sm text-white shadow-sm"
            title="Video Call"
          >
            <VideoIcon className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default CustomChannelHeader;
