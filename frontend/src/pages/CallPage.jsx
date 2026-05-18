import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import useAuthUser from "../hooks/useAuthUser";

import {
  useStreamVideoClient,
  StreamCall,
  CallControls,
  SpeakerLayout,
  StreamTheme,
  CallingState,
  useCallStateHooks,
  useCall,
} from "@stream-io/video-react-sdk";

import "@stream-io/video-react-sdk/dist/css/styles.css";
import toast from "react-hot-toast";
import PageLoader from "../components/PageLoader";
import { PhoneOffIcon, MicIcon, MicOffIcon } from "lucide-react";

const CallPage = () => {
  const { id: callId } = useParams();
  const navigate = useNavigate();
  const videoClient = useStreamVideoClient();
  const [call, setCall] = useState(null);
  const [isConnecting, setIsConnecting] = useState(true);

  // Use refs so closures always see the latest value
  const callTypeRef = useRef("video");       // "audio" | "video"
  const returnFriendIdRef = useRef(null);    // friend's userId for back-navigation
  const hasLeft = useRef(false);

  const { authUser, isLoading } = useAuthUser();

  useEffect(() => {
    if (!authUser || !callId || !videoClient) return;

    let callInstance = null;

    const initCall = async () => {
      try {
        callInstance = videoClient.call("default", callId);

        // getOrCreate — works for both caller (creates) and callee (gets existing)
        const result = await callInstance.getOrCreate();

        // ── Read metadata stored by the caller ──
        const custom = result?.call?.custom || {};
        const detectedType = custom.callType || "video";
        callTypeRef.current = detectedType;

        // Resolve return friend ID
        const customFriendId = custom.friendId;
        if (customFriendId) {
          returnFriendIdRef.current = customFriendId;
        } else {
          // Fallback: pick the other member from the call members list
          const members = result?.call?.members || [];
          const other = members.find((m) => m.user_id !== authUser._id);
          if (other) returnFriendIdRef.current = other.user_id;
        }

        // Disable camera before joining for audio calls
        if (detectedType === "audio") {
          await callInstance.camera.disable();
        }

        await callInstance.join();

        console.log(`[CallPage] Joined ${detectedType} call. Return to: /chats/${returnFriendIdRef.current}`);
        setCall(callInstance);
      } catch (error) {
        console.error("[CallPage] Error joining call:", error);
        toast.error("Could not join the call.");
        navigate(returnFriendIdRef.current ? `/chats/${returnFriendIdRef.current}` : "/chats");
      } finally {
        setIsConnecting(false);
      }
    };

    initCall();

    return () => {
      // Cleanup on unmount — release hardware silently
      if (callInstance && !hasLeft.current) {
        callInstance.camera.disable().catch(() => {});
        callInstance.microphone.disable().catch(() => {});
        callInstance.leave().catch(() => {});
      }
      // CRITICAL: Reset hasLeft so React 18 Strict Mode double-mount doesn't
      // permanently block the hangup button on the second (real) mount.
      hasLeft.current = false;
    };
  }, [authUser, callId, videoClient]);

  if (isLoading || isConnecting) return <PageLoader />;

  if (!call) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center p-6 text-white">
          <p className="text-lg mb-4">Could not connect to the call.</p>
          <button
            onClick={() =>
              navigate(
                returnFriendIdRef.current
                  ? `/chats/${returnFriendIdRef.current}`
                  : "/chats"
              )
            }
            className="btn btn-primary"
          >
            Back to Chats
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-gray-900 overflow-hidden">
      <StreamCall call={call}>
        <CallUI
          authUser={authUser}
          hasLeft={hasLeft}
          callTypeRef={callTypeRef}
          returnFriendIdRef={returnFriendIdRef}
        />
      </StreamCall>
    </div>
  );
};

// ─────────────────────────────────────────────────────
// Main UI inside StreamCall context
// ─────────────────────────────────────────────────────
const CallUI = ({ authUser, hasLeft, callTypeRef, returnFriendIdRef }) => {
  const { useCallCallingState, useParticipantCount } = useCallStateHooks();
  const callingState = useCallCallingState();
  const participantCount = useParticipantCount();
  const call = useCall();
  const navigate = useNavigate();

  // ── Central leave handler: always navigates to friend's chat ──
  const handleLeave = useCallback(async () => {
    if (hasLeft.current) return;
    hasLeft.current = true;

    // Kill hardware first
    if (call) {
      try { call.camera.disable(); } catch (_) {}
      try { call.microphone.disable(); } catch (_) {}
      try { await call.leave(); } catch (_) {}
    }

    // Always go back to the friend's chat
    const dest = returnFriendIdRef.current
      ? `/chats/${returnFriendIdRef.current}`
      : "/chats";
    navigate(dest);
  }, [call, navigate, hasLeft, returnFriendIdRef]);

  // Auto-navigate when the remote side hangs up
  useEffect(() => {
    if (
      callingState === CallingState.LEFT ||
      callingState === CallingState.IDLE
    ) {
      if (!hasLeft.current) {
        hasLeft.current = true;
        if (call) {
          call.camera.disable().catch(() => {});
          call.microphone.disable().catch(() => {});
        }
        const dest = returnFriendIdRef.current
          ? `/chats/${returnFriendIdRef.current}`
          : "/chats";
        navigate(dest);
      }
    }
  }, [callingState, call, navigate, hasLeft, returnFriendIdRef]);

  const callType = callTypeRef.current;

  // ── Outgoing/Waiting screen — shown for BOTH audio and video when alone ──
  if (callingState === CallingState.JOINED && participantCount <= 1) {
    const members = call?.state?.members
      ? Object.values(call.state.members)
      : [];
    const otherMember = members.find((m) => m.user_id !== authUser._id);
    const friendUser = otherMember?.user;

    return (
      <OutgoingCallScreen
        friendUser={friendUser}
        callType={callType}
        onHangup={handleLeave}
      />
    );
  }

  // ── Active audio call (2+ participants) ──
  if (callType === "audio") {
    return (
      <AudioCallLayout
        call={call}
        authUser={authUser}
        onLeave={handleLeave}
      />
    );
  }

  // ── Active video call (2+ participants) ──
  return (
    <StreamTheme>
      <div className="h-screen flex flex-col bg-gray-900">
        <div className="flex-1 min-h-0 overflow-hidden">
          <SpeakerLayout participantsBarPosition="bottom" />
        </div>
        <div className="shrink-0">
          <CallControls onLeave={handleLeave} />
        </div>
      </div>
    </StreamTheme>
  );
};

// ─────────────────────────────────────────────────────
// Outgoing / Ringing screen — no camera, shows friend avatar
// ─────────────────────────────────────────────────────
const OutgoingCallScreen = ({ friendUser, callType, onHangup }) => (
  <div className="h-full w-full flex flex-col items-center justify-center bg-gray-900">
    <div className="flex flex-col items-center gap-6 px-4 text-center">
      {/* Pulsing avatar */}
      <div className="relative w-28 h-28 sm:w-40 sm:h-40">
        <div className="absolute inset-0 rounded-full bg-blue-500/25 animate-ping" />
        <div className="absolute inset-2 rounded-full bg-blue-500/15 animate-ping [animation-delay:300ms]" />
        <img
          src={friendUser?.image || "/avatar.png"}
          alt={friendUser?.name || "Friend"}
          className="w-28 h-28 sm:w-40 sm:h-40 rounded-full object-cover border-4 border-white/20 shadow-2xl relative z-10"
        />
      </div>

      {/* Name & label */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white">
          {friendUser?.name || "Calling..."}
        </h2>
        <p className="text-white/60 text-base sm:text-lg mt-1 animate-pulse">
          {callType === "audio" ? "🎙️ Audio Call" : "📹 Video Call"} · Ringing...
        </p>
      </div>

      {/* Red hang-up button */}
      <button
        onClick={onHangup}
        className="mt-2 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-500 hover:bg-red-600 active:bg-red-700 flex items-center justify-center shadow-2xl transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-red-500/50"
      >
        <PhoneOffIcon className="w-7 h-7 sm:w-9 sm:h-9 text-white" />
      </button>
      <p className="text-white/30 text-xs">Tap to cancel</p>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────
// Audio call active layout — avatars, mic toggle, hangup
// ─────────────────────────────────────────────────────
const AudioCallLayout = ({ call, authUser, onLeave }) => {
  const { useParticipants, useCallCallingState } = useCallStateHooks();
  const participants = useParticipants();
  const callingState = useCallCallingState();
  const [muted, setMuted] = useState(false);

  const remoteParticipants = participants.filter(
    (p) => p.userId !== authUser._id
  );

  const toggleMic = async () => {
    try {
      if (muted) {
        await call.microphone.enable();
      } else {
        await call.microphone.disable();
      }
      setMuted((m) => !m);
    } catch (e) {
      console.error("Mic toggle error:", e);
    }
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-900 gap-8 px-4">
      {/* Remote participant avatars */}
      <div className="flex flex-wrap gap-6 justify-center">
        {remoteParticipants.map((p) => (
          <div key={p.userId} className="flex flex-col items-center gap-3">
            <div className="relative">
              <img
                src={p.image || "/avatar.png"}
                alt={p.name || "User"}
                className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-green-500 shadow-2xl"
              />
              <span className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-900 animate-pulse" />
            </div>
            <p className="text-white font-semibold text-sm sm:text-base">
              {p.name || "User"}
            </p>
          </div>
        ))}
      </div>

      {/* Your avatar */}
      <div className="flex flex-col items-center gap-1 opacity-60">
        <img
          src={authUser?.profilePic || "/avatar.png"}
          alt="You"
          className="w-14 h-14 rounded-full object-cover border-2 border-white/20"
        />
        <p className="text-white/50 text-xs">You</p>
      </div>

      {/* Status */}
      <p className="text-green-400 font-medium text-sm sm:text-base">
        🎙️ Audio Call ·{" "}
        {callingState === CallingState.JOINED ? "Connected" : "Connecting..."}
      </p>

      {/* Controls */}
      <div className="flex gap-8 items-center">
        {/* Mic toggle */}
        <button
          onClick={toggleMic}
          className={`w-16 h-16 sm:w-18 sm:h-18 rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-105 active:scale-95 focus:outline-none ${
            muted
              ? "bg-red-500 hover:bg-red-600"
              : "bg-gray-700 hover:bg-gray-600"
          }`}
        >
          {muted ? (
            <MicOffIcon className="w-7 h-7 text-white" />
          ) : (
            <MicIcon className="w-7 h-7 text-white" />
          )}
        </button>

        {/* Hang up — Red, goes back to chat */}
        <button
          onClick={onLeave}
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-500 hover:bg-red-600 active:bg-red-700 flex items-center justify-center shadow-2xl transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-red-500/50"
        >
          <PhoneOffIcon className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
        </button>
      </div>
    </div>
  );
};

export default CallPage;