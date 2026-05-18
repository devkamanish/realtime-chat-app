import { useEffect, useState, createContext, useContext } from "react";
import { StreamChat, Channel } from "stream-chat";
import {
  StreamVideo,
  StreamVideoClient,
  CallingState,
  useCalls,
} from "@stream-io/video-react-sdk";
import useAuthUser from "../hooks/useAuthUser";
import { useQuery } from "@tanstack/react-query";
import { getStreamToken } from "../lib/api";
import PageLoader from "../components/PageLoader";
import { PhoneIcon, VideoIcon, PhoneOffIcon } from "lucide-react";
import { useNavigate } from "react-router";

// Patch Channel.prototype.sendReaction to enforce single reaction per user
const _originalSendReaction = Channel.prototype.sendReaction;
if (_originalSendReaction && !Channel.prototype._patchedReaction) {
  Channel.prototype.sendReaction = function (messageId, reaction, options) {
    return _originalSendReaction.call(this, messageId, reaction, {
      ...options,
      enforce_unique: true,
    });
  };
  Channel.prototype._patchedReaction = true;
}

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

// Context for sharing the chat client
export const StreamChatContext = createContext(null);
export const useStreamChatClient = () => useContext(StreamChatContext);

// ──────────────────────────────────────────────
// Incoming Call Modal — rendered globally
// ──────────────────────────────────────────────
const GlobalRingingCall = () => {
  const calls = useCalls();
  const navigate = useNavigate();

  // Find a call that is ringing AND was NOT created by the current user
  const incomingCall = calls.find(
    (c) => c.isCreatedByMe === false && c.state.callingState === CallingState.RINGING
  );

  if (!incomingCall) return null;

  const caller = incomingCall.state.createdBy;
  // Read the custom callType set by the caller
  const callType = incomingCall.custom?.callType || "video";
  const isAudio = callType === "audio";

  const handleAccept = async () => {
    try {
      // For audio calls, disable camera BEFORE joining so it never activates
      if (isAudio) {
        await incomingCall.camera.disable();
      }
      await incomingCall.join();
      navigate(`/call/${incomingCall.id}`);
    } catch (err) {
      console.error("Error accepting call:", err);
    }
  };

  const handleDecline = async () => {
    try {
      await incomingCall.leave({ reject: true });
    } catch (err) {
      console.error("Error declining call:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="bg-base-100 rounded-3xl shadow-2xl flex flex-col items-center gap-5 w-[90vw] max-w-xs sm:max-w-sm p-6 sm:p-8 border border-base-300">
        {/* Pulsing avatar */}
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" />
          <img
            src={caller?.image || "/avatar.png"}
            alt="caller"
            className="w-24 h-24 rounded-full object-cover border-4 border-base-200 shadow-lg relative z-10"
          />
        </div>

        {/* Name + call type */}
        <div className="text-center">
          <h2 className="text-xl sm:text-2xl font-bold mb-1">
            {caller?.name || "Someone"}
          </h2>
          <p className="text-base-content/60 text-sm flex items-center justify-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
            </span>
            Incoming {isAudio ? "🎙️ Audio" : "📹 Video"} Call...
          </p>
        </div>

        {/* Decline / Accept */}
        <div className="flex gap-8 mt-2">
          {/* Red hang-up */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={handleDecline}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-xl transition-all hover:scale-105 active:scale-95"
            >
              <PhoneOffIcon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </button>
            <span className="text-xs text-base-content/50">Decline</span>
          </div>

          {/* Green accept */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={handleAccept}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center shadow-xl transition-all hover:scale-105 active:scale-95"
            >
              {isAudio ? (
                <PhoneIcon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              ) : (
                <VideoIcon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              )}
            </button>
            <span className="text-xs text-base-content/50">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────
// StreamClientProvider — wraps the entire app
// ──────────────────────────────────────────────
export const StreamClientProvider = ({ children }) => {
  const { authUser } = useAuthUser();
  const [videoClient, setVideoClient] = useState(null);
  const [chatClient, setChatClient] = useState(null);

  const { data: tokenData } = useQuery({
    queryKey: ["streamToken"],
    queryFn: getStreamToken,
    enabled: !!authUser,
  });

  useEffect(() => {
    let isMounted = true;

    const initClients = async () => {
      if (!authUser || !tokenData?.token) return;

      try {
        // ── Chat Client ──
        const chat = StreamChat.getInstance(STREAM_API_KEY);
        if (chat.userID !== authUser._id) {
          if (chat.userID) await chat.disconnectUser();
          await chat.connectUser(
            {
              id: authUser._id,
              name: authUser.fullName,
              image: authUser.profilePic,
            },
            tokenData.token
          );
        }

        // ── Video Client ──
        const video = new StreamVideoClient({
          apiKey: STREAM_API_KEY,
          user: {
            id: authUser._id,
            name: authUser.fullName,
            image: authUser.profilePic,
          },
          token: tokenData.token,
        });

        if (isMounted) {
          setChatClient(chat);
          setVideoClient(video);
        }
      } catch (error) {
        console.error("Error initializing Stream clients:", error);
      }
    };

    initClients();

    return () => {
      isMounted = false;
    };
  }, [authUser, tokenData]);

  // Not logged in — render children directly (login page, etc.)
  if (!authUser) {
    return <>{children}</>;
  }

  // Logged in but clients not ready yet
  if (!videoClient || !chatClient) {
    return <PageLoader />;
  }

  return (
    <StreamChatContext.Provider value={chatClient}>
      <StreamVideo client={videoClient}>
        {children}
        <GlobalRingingCall />
      </StreamVideo>
    </StreamChatContext.Provider>
  );
};
