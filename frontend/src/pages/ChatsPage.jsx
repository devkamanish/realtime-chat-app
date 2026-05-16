import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { useQuery } from "@tanstack/react-query";
import { getStreamToken, getUserFriends, createVideoCall } from "../lib/api";

import {
  Channel,
  ChannelHeader,
  Chat,
  MessageInput,
  MessageList,
  Thread,
  Window,
} from "stream-chat-react";
import { StreamChat } from "stream-chat";
import "stream-chat-react/dist/css/v2/index.css";

import toast from "react-hot-toast";
import {
  MessageSquareIcon,
  LoaderIcon,
  ArrowLeftIcon,
} from "lucide-react";

import CallButton from "../components/CallButton";
import FriendCard from "../components/FriendCard";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

const ChatsPage = () => {
  const { id: activeFriendId } = useParams();
  const navigate = useNavigate();

  const [chatClient, setChatClient] = useState(null);
  const [activeChannel, setActiveChannel] = useState(null);
  const [loadingChat, setLoadingChat] = useState(false);

  const { authUser } = useAuthUser();

  const { data: tokenData } = useQuery({
    queryKey: ["streamToken"],
    queryFn: getStreamToken,
    enabled: !!authUser,
  });

  const { data: friends = [], isLoading: loadingFriends } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
  });

  // Initialize Stream Chat client once
  useEffect(() => {
    let isMounted = true;
    const initClient = async () => {
      if (!tokenData?.token || !authUser) return;

      try {
        const client = StreamChat.getInstance(STREAM_API_KEY);

        if (client.userID === authUser._id) {
          if (isMounted) setChatClient(client);
          return;
        }

        if (client.userID) {
          await client.disconnectUser();
        }

        await client.connectUser(
          {
            id: authUser._id,
            name: authUser.fullName,
            image: authUser.profilePic,
          },
          tokenData.token
        );

        if (isMounted) setChatClient(client);
      } catch (error) {
        console.error("Error initializing chat client:", error);
        if (isMounted) toast.error("Could not connect to chat.");
      }
    };

    initClient();

    return () => {
      isMounted = false;
    };
  }, [tokenData, authUser]);

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

  const handleVideoCall = async () => {
    if (!activeChannel || !activeFriendId) return;

    try {
      const { callId } = await createVideoCall(activeFriendId);
      const callUrl = `${window.location.origin}/call/${callId}`;

      await activeChannel.sendMessage({
        text: `📹 Video Call`,
        attachments: [
          {
            type: "video-call",
            callId: callId,
            callUrl: callUrl,
            title: "Video Call",
            text: "Click to join the video call",
          },
        ],
      });

      navigate(`/call/${callId}`);
    } catch (error) {
      console.error("Error creating video call:", error);
      const message =
        error?.response?.data?.message || "Could not start video call.";
      toast.error(message);
    }
  };

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
      {/* Back button */}
      <div className="px-4 py-2 border-b border-base-300 bg-base-200 flex items-center gap-3">
        <button
          onClick={() => navigate("/chats")}
          className="btn btn-ghost btn-sm btn-circle"
        >
          <ArrowLeftIcon className="size-5" />
        </button>
        <span className="font-semibold text-sm opacity-70">Back to Chats</span>
      </div>

      {/* Chat interface */}
      <div className="flex-1 overflow-hidden">
        <Chat client={chatClient}>
          <Channel channel={activeChannel}>
            <div className="w-full relative h-full flex flex-col">
              <CallButton handleVideoCall={handleVideoCall} />
              <Window>
                <ChannelHeader />
                <MessageList />
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
