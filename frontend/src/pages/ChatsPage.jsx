import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { useQuery } from "@tanstack/react-query";
import { getUserFriends } from "../lib/api";

import {
  Channel,
  Chat,
  MessageInput,
  MessageList,
  Thread,
  Window
} from "stream-chat-react";
import { useStreamVideoClient } from "@stream-io/video-react-sdk";
import { useStreamChatClient } from "../providers/StreamClientProvider";
import "stream-chat-react/dist/css/v2/index.css";

import toast from "react-hot-toast";
import {
  MessageSquareIcon,
  LoaderIcon,
} from "lucide-react";


import FriendCard from "../components/FriendCard";
import CustomChannelHeader from "../components/CustomChannelHeader";
import PinnedMessages from "../components/PinnedMessages";

const ChatsPage = () => {
  const { id: activeFriendId } = useParams();
  const navigate = useNavigate();

  const chatClient = useStreamChatClient();
  const videoClient = useStreamVideoClient();

  const [activeChannel, setActiveChannel] = useState(null);
  const [loadingChat, setLoadingChat] = useState(false);

  const { authUser } = useAuthUser();

  const { data: friends = [], isLoading: loadingFriends } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
  });

  // Chat client is now initialized globally, no need for local useEffect

  // Open channel when a friend is selected
  const openChannel = useCallback(
    async (friendId) => {
      if (!chatClient || !authUser || !friendId) return;

      setLoadingChat(true);
      try {
        const channelId = [authUser._id, friendId].sort().join("-");
        const channel = chatClient.channel("messaging", channelId, {
          members: [authUser._id, friendId],
        });

        await channel.watch();
        setActiveChannel(channel);
      } catch (error) {
        console.error("Error opening channel:", error);
        toast.error("Could not open this conversation.");
      } finally {
        setLoadingChat(false);
      }
    },
    [chatClient, authUser]
  );

  // When activeFriendId changes (from URL), open that channel
  useEffect(() => {
    if (activeFriendId && chatClient) {
      openChannel(activeFriendId);
    }
  }, [activeFriendId, chatClient, openChannel]);

  const handleCall = async (type) => {
    if (!activeFriendId || !videoClient || !authUser) return;

    try {
      const callId = crypto.randomUUID();
      const call = videoClient.call("default", callId);

      await call.getOrCreate({
        ring: true,
        data: {
          members: [
            { user_id: authUser._id },
            { user_id: activeFriendId },
          ],
          custom: {
            callType: type,            // "audio" or "video"
            friendId: activeFriendId,  // used by CallPage to navigate back
          },
        },
      });

      // For audio calls, disable camera before navigating
      if (type === "audio") {
        await call.camera.disable();
      }

      navigate(`/call/${callId}`);
    } catch (error) {
      console.error("Error creating call:", error);
      toast.error("Could not start call. Please try again.");
    }
  };

  const handleVideoCall = () => handleCall("video");
  const handleAudioCall = () => handleCall("audio");

  // --- NO FRIEND SELECTED: show friend list like FriendsPage ---
  if (!activeFriendId) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="container mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
              <MessageSquareIcon className="size-6 text-primary" />
              Chats
            </h2>
          </div>

          {loadingFriends ? (
            <div className="flex justify-center py-12">
              <span className="loading loading-spinner loading-lg" />
            </div>
          ) : friends.length === 0 ? (
            <div className="card bg-base-200 p-8 text-center">
              <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <MessageSquareIcon className="size-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">No conversations yet</h3>
              <p className="text-base-content opacity-70">
                Add friends to start chatting!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {friends.map((friend) => (
                <FriendCard key={friend._id} friend={friend} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- FRIEND SELECTED: show chat ---
  if (loadingChat || !chatClient || !activeChannel) {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col items-center justify-center">
        <LoaderIcon className="animate-spin size-10 text-primary" />
        <p className="mt-4 text-lg font-mono">Connecting to chat...</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Chat interface */}
      <div className="flex-1 overflow-hidden">
        <Chat client={chatClient}>
          <Channel channel={activeChannel}>
            <div className="w-full h-full flex flex-col">
              <Window>
                <CustomChannelHeader
                  friend={friends.find(f => f._id === activeFriendId)}
                  onBack={() => navigate("/chats")}
                  handleVideoCall={handleVideoCall}
                  handleAudioCall={handleAudioCall}
                />
                <PinnedMessages />
                <MessageList
                  messageActions={['edit', 'delete', 'quote', 'reply', 'react', 'pinMessage']}
                />
                <MessageInput focus />
              </Window>
            </div>
            <Thread />
          </Channel>
        </Chat>
      </div>
    </div>
  );
};

export default ChatsPage;
