import { useChannelStateContext, useChannelActionContext } from "stream-chat-react";
import { PinIcon } from "lucide-react";

const PinnedMessages = () => {
  const { channel } = useChannelStateContext();
  const { jumpToMessage } = useChannelActionContext();
  const pinnedMessages = channel?.state?.pinnedMessages || [];

  if (pinnedMessages.length === 0) return null;

  return (
    <div className="bg-base-200 border-b border-base-300 shadow-sm z-10 w-full flex flex-col p-2 gap-1 text-sm">
      {pinnedMessages.slice(-2).map((msg) => (
        <div key={msg.id} className="flex items-center gap-2 bg-base-100 p-2 rounded-md cursor-pointer hover:bg-base-300 transition-colors"
             onClick={() => {
                jumpToMessage(msg.id);
             }}
        >
          <PinIcon className="size-4 text-primary shrink-0" />
          <div className="truncate font-medium text-base-content/80 flex-1">
             {msg.user?.name || "User"}: {msg.text}
          </div>
        </div>
      ))}
    </div>
  );
};

export default PinnedMessages;
