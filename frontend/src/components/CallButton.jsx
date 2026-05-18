import { VideoIcon, PhoneIcon } from "lucide-react";

function CallButton({ handleVideoCall, handleAudioCall }) {
  return (
    <div className="p-3 border-b flex items-center justify-end max-w-7xl mx-auto w-full absolute top-0 z-10 bg-base-100/50 backdrop-blur-sm">
      <div className="flex gap-3">
        <button onClick={handleAudioCall} className="btn btn-primary btn-sm text-white shadow-sm" title="Audio Call">
          <PhoneIcon className="size-5" />
        </button>
        <button onClick={handleVideoCall} className="btn btn-success btn-sm text-white shadow-sm" title="Video Call">
          <VideoIcon className="size-5" />
        </button>
      </div>
    </div>
  );
}

export default CallButton;
